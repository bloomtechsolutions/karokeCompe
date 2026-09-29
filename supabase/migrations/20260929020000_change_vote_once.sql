-- Voters may change their vote once per category per round, from the same
-- device, while voting is still open. The original choice is kept for audit.

alter table public.audience_votes
  add column if not exists previous_contestant_id uuid references public.contestants (id) on delete set null,
  add column if not exists changed_at timestamptz;

-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'no_vote' | 'same' | 'change_used'
create or replace function public.change_vote(
  p_contestant uuid, p_voter_token text, p_voter_ip text
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
  else
    select * into v_vote from public.audience_votes
      where voter_token = p_voter_token and category = v_category and round = v_round
      for update;
    if not found then
      v_result := 'no_vote';
    elsif v_vote.changed_at is not null then
      v_result := 'change_used';
    elsif v_vote.contestant_id = p_contestant then
      v_result := 'same';
    else
      update public.audience_votes
        set previous_contestant_id = contestant_id,
            contestant_id = p_contestant,
            changed_at = now()
        where id = v_vote.id;
      v_result := 'ok';
    end if;
  end if;

  if v_result <> 'ok' then
    insert into public.vote_attempts (contestant_id, category, round, voter_ref, voter_ip, result)
    values (p_contestant, v_category, v_round, v_vote.voter_ref, v_ip, 'change_' || v_result);
  end if;
  return v_result;
end;
$$;

revoke all on function public.change_vote(uuid, text, text) from public, anon, authenticated;
grant execute on function public.change_vote(uuid, text, text) to service_role;

-- Voter status now says whether the one change has been used.
drop function if exists public.voter_status(text);
create function public.voter_status(p_voter_token text)
returns table (round text, category text, contestant_id uuid, changed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select round, category, contestant_id, changed_at is not null
  from public.audience_votes where voter_token = p_voter_token;
$$;

revoke all on function public.voter_status(text) from public, anon, authenticated;
grant execute on function public.voter_status(text) to service_role;
