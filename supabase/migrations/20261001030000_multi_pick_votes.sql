-- Round 1: each voter can pick up to as many performers as go through to
-- the final (5 solo, 3 duet). The final stays one pick per category.
-- Each pick is one row in audience_votes and one vote for that performer.
-- One change per category per round: swap one pick for another.

-- One row per pick: the same voter can't pick the same performer twice.
drop index if exists public.audience_votes_token_round_idx;
drop index if exists public.audience_votes_voter_ref_round_idx;
create unique index if not exists audience_votes_token_pick_idx
  on public.audience_votes (voter_token, category, round, contestant_id);
create unique index if not exists audience_votes_voter_ref_pick_idx
  on public.audience_votes (lower(voter_ref), category, round, contestant_id)
  where voter_ref is not null;

-- How many picks a voter has in a category this round.
create or replace function public.vote_limit(p_round text, p_category text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_round = 'round1' and p_category = 'solo' then s.finalists_solo
    when p_round = 'round1' and p_category = 'duet' then s.finalists_duet
    else 1
  end
  from public.settings s where s.id = 1;
$$;

revoke all on function public.vote_limit(text, text) from public, anon;
grant execute on function public.vote_limit(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- cast_vote: one pick
-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'voter_id_required'
--        | 'not_checked_in' | 'already_picked' | 'already_voted'
--        | 'voter_id_used' | 'limit_reached' | 'ip_used'
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_contestant uuid, p_voter_token text, p_voter_ref text, p_voter_ip text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.settings;
  v_round text;
  v_category text;
  v_ref text := nullif(upper(trim(p_voter_ref)), '');
  v_ip text := nullif(trim(p_voter_ip), '');
  v_result text;
begin
  select * into v_settings from public.settings where id = 1;
  v_round := case when v_settings.stage in ('round1', 'final') then v_settings.stage end;

  if v_round = 'final' then
    select category into v_category from public.contestants where id = p_contestant and is_finalist;
  elsif v_round = 'round1' then
    select category into v_category from public.contestants where id = p_contestant;
  end if;

  if v_round is null or not v_settings.voting_open then
    v_result := 'closed';
  elsif v_category is null or coalesce(length(p_voter_token), 0) < 16 then
    v_result := 'invalid';
  elsif v_round = 'final' and not public.category_voting_ready(v_category) then
    v_result := 'not_ready';
  elsif v_round = 'round1' and not public.r1_started(p_contestant) then
    v_result := 'not_ready';
  elsif (v_settings.require_voter_id or v_settings.require_checkin) and v_ref is null then
    v_result := 'voter_id_required';
  elsif v_settings.require_checkin
        and not exists (select 1 from public.venue_staff where staff_id = v_ref) then
    v_result := 'not_checked_in';
  else
    -- Serialise votes per category so simultaneous duplicates can't slip through.
    perform pg_advisory_xact_lock(hashtext('vote:' || v_round || ':' || v_category));
    if exists (select 1 from public.audience_votes
               where voter_token = p_voter_token and category = v_category and round = v_round
                 and contestant_id = p_contestant) then
      v_result := 'already_picked';
    elsif exists (select 1 from public.audience_votes
               where voter_token = p_voter_token and category = v_category and round = v_round
                 and voter_ref is distinct from v_ref) then
      -- This device already voted here with another staff ID.
      v_result := 'already_voted';
    elsif v_ref is not null and exists (select 1 from public.audience_votes
               where lower(voter_ref) = lower(v_ref) and category = v_category and round = v_round
                 and voter_token <> p_voter_token) then
      -- This staff ID already voted here from another device.
      v_result := 'voter_id_used';
    elsif (select count(*) from public.audience_votes
           where voter_token = p_voter_token and category = v_category and round = v_round)
          >= public.vote_limit(v_round, v_category) then
      v_result := case when public.vote_limit(v_round, v_category) = 1 then 'already_voted' else 'limit_reached' end;
    elsif v_settings.block_repeat_ip and v_ip is not null and exists (select 1 from public.audience_votes
               where voter_ip = v_ip and category = v_category and round = v_round
                 and voter_token <> p_voter_token) then
      v_result := 'ip_used';
    else
      insert into public.audience_votes (contestant_id, category, round, voter_token, voter_ref, voter_ip)
      values (p_contestant, v_category, v_round, p_voter_token, v_ref, v_ip);
      v_result := 'ok';
    end if;
  end if;

  if v_result <> 'ok' then
    insert into public.vote_attempts (contestant_id, category, round, voter_ref, voter_ip, result)
    values (p_contestant, v_category, v_round, v_ref, v_ip, v_result);
  end if;
  return v_result;
exception
  when unique_violation then
    insert into public.vote_attempts (contestant_id, category, round, voter_ref, voter_ip, result)
    values (p_contestant, v_category, v_round, v_ref, v_ip, 'already_picked');
    return 'already_picked';
end;
$$;

revoke all on function public.cast_vote(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- change_vote: swap one pick (p_from -> p_to), once per category per round.
-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'no_vote' | 'same' | 'change_used'
-- ---------------------------------------------------------------------------
drop function if exists public.change_vote(uuid, text, text);
create or replace function public.change_vote(
  p_from uuid, p_to uuid, p_voter_token text, p_voter_ip text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.settings;
  v_round text;
  v_category text;
  v_vote public.audience_votes;
  v_ip text := nullif(trim(p_voter_ip), '');
  v_result text;
begin
  select * into v_settings from public.settings where id = 1;
  v_round := case when v_settings.stage in ('round1', 'final') then v_settings.stage end;

  if v_round = 'final' then
    select category into v_category from public.contestants where id = p_to and is_finalist;
  elsif v_round = 'round1' then
    select category into v_category from public.contestants where id = p_to;
  end if;

  if v_round is null or not v_settings.voting_open then
    v_result := 'closed';
  elsif v_category is null or coalesce(length(p_voter_token), 0) < 16 then
    v_result := 'invalid';
  elsif v_round = 'final' and not public.category_voting_ready(v_category) then
    v_result := 'not_ready';
  elsif v_round = 'round1' and not public.r1_started(p_to) then
    v_result := 'not_ready';
  else
    perform pg_advisory_xact_lock(hashtext('vote:' || v_round || ':' || v_category));
    select * into v_vote from public.audience_votes
      where voter_token = p_voter_token and category = v_category and round = v_round
        and contestant_id = p_from
      for update;
    if not found then
      v_result := 'no_vote';
    elsif exists (select 1 from public.audience_votes
                  where voter_token = p_voter_token and category = v_category and round = v_round
                    and changed_at is not null) then
      v_result := 'change_used';
    elsif p_from = p_to or exists (select 1 from public.audience_votes
                  where voter_token = p_voter_token and category = v_category and round = v_round
                    and contestant_id = p_to) then
      v_result := 'same';
    else
      update public.audience_votes
        set previous_contestant_id = contestant_id,
            contestant_id = p_to,
            changed_at = now()
        where id = v_vote.id;
      v_result := 'ok';
    end if;
  end if;

  if v_result <> 'ok' then
    insert into public.vote_attempts (contestant_id, category, round, voter_ref, voter_ip, result)
    values (p_to, v_category, v_round, v_vote.voter_ref, v_ip, 'change_' || v_result);
  end if;
  return v_result;
end;
$$;

revoke all on function public.change_vote(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.change_vote(uuid, uuid, text, text) to service_role;
