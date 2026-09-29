-- Audience voting in the 1st round too.
--   * Votes are kept per round: one vote per voter per category per round.
--   * Round 1 voting opens (per category) once its first performer has been
--     called to the stage, and stays open until the organiser closes it.
--     Voters can pick any performer in the category who has started.
--   * Round 1 score = judges' average x judge_weight% + audience points,
--     the same formula as the final (computed in the app).

-- ---------------------------------------------------------------------------
-- Votes and attempts carry the round
-- ---------------------------------------------------------------------------
alter table public.audience_votes
  add column if not exists round text not null default 'final' check (round in ('round1', 'final'));
alter table public.vote_attempts add column if not exists round text;

alter table public.audience_votes drop constraint if exists audience_votes_voter_token_category_key;
drop index if exists public.audience_votes_voter_ref_idx;
drop index if exists public.audience_votes_ip_idx;
create unique index if not exists audience_votes_token_round_idx
  on public.audience_votes (voter_token, category, round);
create unique index if not exists audience_votes_voter_ref_round_idx
  on public.audience_votes (lower(voter_ref), category, round)
  where voter_ref is not null;
create index if not exists audience_votes_ip_round_idx on public.audience_votes (voter_ip, category, round);

-- ---------------------------------------------------------------------------
-- Remember who has been called to the stage in round 1
-- ---------------------------------------------------------------------------
alter table public.contestants add column if not exists r1_called_at timestamptz;

create or replace function public.track_last_on_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    new.last_on_stage := null;
  end if;
  if new.now_performing is not null then
    new.last_on_stage := new.now_performing;
    if new.stage = 'round1' then
      update public.contestants
        set r1_called_at = coalesce(r1_called_at, now())
        where id = new.now_performing;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.track_last_on_stage() from public, anon, authenticated;

-- Anyone already on stage or scored in round 1 has started.
update public.contestants c
  set r1_called_at = coalesce(c.r1_called_at, now())
  where c.id = (select now_performing from public.settings where id = 1 and stage = 'round1')
     or exists (select 1 from public.scores s where s.contestant_id = c.id and s.round = 'round1');

-- Round 1: a performer is on the ballot once they have been called or scored.
create or replace function public.r1_started(p_contestant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.contestants where id = p_contestant and r1_called_at is not null)
      or exists (select 1 from public.scores where contestant_id = p_contestant and round = 'round1');
$$;

revoke all on function public.r1_started(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- cast_vote: round aware
-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'voter_id_required'
--        | 'already_voted' | 'voter_id_used' | 'ip_used'
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
  elsif v_settings.require_voter_id and v_ref is null then
    v_result := 'voter_id_required';
  else
    -- Serialise votes per category so simultaneous duplicates can't slip through.
    perform pg_advisory_xact_lock(hashtext('vote:' || v_round || ':' || v_category));
    if exists (select 1 from public.audience_votes
               where voter_token = p_voter_token and category = v_category and round = v_round) then
      v_result := 'already_voted';
    elsif v_ref is not null and exists (select 1 from public.audience_votes
               where lower(voter_ref) = lower(v_ref) and category = v_category and round = v_round) then
      v_result := 'voter_id_used';
    elsif v_settings.block_repeat_ip and v_ip is not null and exists (select 1 from public.audience_votes
               where voter_ip = v_ip and category = v_category and round = v_round) then
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
    values (p_contestant, v_category, v_round, v_ref, v_ip, 'already_voted');
    return 'already_voted';
end;
$$;

revoke all on function public.cast_vote(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, text) to service_role;

-- Which categories a voter token has voted in, per round.
drop function if exists public.voter_status(text);
create function public.voter_status(p_voter_token text)
returns table (round text, category text, contestant_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select round, category, contestant_id from public.audience_votes where voter_token = p_voter_token;
$$;

revoke all on function public.voter_status(text) from public, anon, authenticated;
grant execute on function public.voter_status(text) to service_role;

-- Votes cast in the current round (the final once the competition is over).
create or replace function public.vote_total()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.audience_votes
  where round = (select case when stage = 'round1' then 'round1' else 'final' end
                 from public.settings where id = 1);
$$;

grant execute on function public.vote_total() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard: round 1 votes and whether each performer has started
-- ---------------------------------------------------------------------------
drop function if exists public.leaderboard();
create function public.leaderboard()
returns table (
  contestant_id uuid,
  name text,
  category text,
  department text,
  song_round1 text,
  song_final text,
  performance_order int,
  final_order int,
  is_finalist boolean,
  r1_avg numeric,
  r1_vocal_avg numeric,
  r1_judges int,
  final_avg numeric,
  final_vocal_avg numeric,
  final_judges int,
  votes int,
  r1_votes int,
  r1_started boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from public.settings where id = 1),
  agg as (
    select
      sc.contestant_id,
      avg(sc.total) filter (where sc.round = 'round1') as r1_avg,
      avg(sc.vocal) filter (where sc.round = 'round1') as r1_vocal_avg,
      count(*) filter (where sc.round = 'round1') as r1_judges,
      avg(sc.total) filter (where sc.round = 'final') as final_avg,
      avg(sc.vocal) filter (where sc.round = 'final') as final_vocal_avg,
      count(*) filter (where sc.round = 'final') as final_judges
    from public.scores sc
    group by sc.contestant_id
  ),
  v as (
    select
      contestant_id,
      count(*) filter (where round = 'final') as votes,
      count(*) filter (where round = 'round1') as r1_votes
    from public.audience_votes
    group by contestant_id
  )
  select
    c.id, c.name, c.category, c.department, c.song_round1, c.song_final,
    c.performance_order, c.final_order, c.is_finalist,
    case when s.show_scores or public.is_host() then round(agg.r1_avg, 2) end,
    case when s.show_scores or public.is_host() then round(agg.r1_vocal_avg, 2) end,
    coalesce(agg.r1_judges, 0)::int,
    case when s.show_scores or public.is_host() then round(agg.final_avg, 2) end,
    case when s.show_scores or public.is_host() then round(agg.final_vocal_avg, 2) end,
    coalesce(agg.final_judges, 0)::int,
    case when s.show_scores or public.is_host() then coalesce(v.votes, 0)::int end,
    case when s.show_scores or public.is_host() then coalesce(v.r1_votes, 0)::int end,
    (c.r1_called_at is not null or coalesce(agg.r1_judges, 0) > 0)
  from public.contestants c
  cross join s
  left join agg on agg.contestant_id = c.id
  left join v on v.contestant_id = c.id;
$$;

revoke all on function public.leaderboard() from public;
grant execute on function public.leaderboard() to anon, authenticated;
