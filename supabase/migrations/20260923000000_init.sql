-- Karaoke Competition schema
-- Roles: 'admin' (organiser) and 'judge'. Audience and dashboard viewers are anonymous.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'judge' check (role in ('judge', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- app_metadata can only be set with the service role, so self sign-ups
  -- (if enabled by mistake) get an inactive profile with no access.
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'judge' end,
    coalesce(new.raw_app_meta_data ->> 'role', '') in ('judge', 'admin')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_active_judge()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'judge' and active
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'Karaoke Competition',
  stage text not null default 'setup'
    check (stage in ('setup', 'round1', 'final', 'completed')),
  voting_open boolean not null default false,
  require_voter_id boolean not null default false,
  show_scores boolean not null default true,
  finalists_per_category int not null default 3 check (finalists_per_category between 1 and 20),
  judge_weight numeric not null default 70 check (judge_weight between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Contestants (a duet is a single contestant entry with both names)
-- ---------------------------------------------------------------------------
create table public.contestants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('solo', 'duet')),
  department text,
  song_round1 text,
  song_final text,
  performance_order int,
  final_order int,
  is_finalist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rule: 1st round and final round songs must be different
  constraint final_song_differs check (
    song_final is null or song_round1 is null
    or lower(trim(song_final)) <> lower(trim(song_round1))
  )
);

create index contestants_category_idx on public.contestants (category);

-- ---------------------------------------------------------------------------
-- Judge scores (criteria from the judging sheet)
-- ---------------------------------------------------------------------------
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.profiles (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  round text not null check (round in ('round1', 'final')),
  vocal int not null check (vocal between 0 and 30),
  rhythm int not null check (rhythm between 0 and 20),
  stage_presence int not null check (stage_presence between 0 and 20),
  interpretation int not null check (interpretation between 0 and 15),
  overall int not null check (overall between 0 and 15),
  total int generated always as (vocal + rhythm + stage_presence + interpretation + overall) stored,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (judge_id, contestant_id, round)
);

create index scores_contestant_round_idx on public.scores (contestant_id, round);

-- ---------------------------------------------------------------------------
-- Audience votes (final round only; one vote per voter per category)
-- ---------------------------------------------------------------------------
create table public.audience_votes (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  category text not null check (category in ('solo', 'duet')),
  voter_token text not null,
  voter_ref text,
  created_at timestamptz not null default now(),
  unique (voter_token, category)
);

create unique index audience_votes_voter_ref_idx
  on public.audience_votes (lower(voter_ref), category)
  where voter_ref is not null;
create index audience_votes_contestant_idx on public.audience_votes (contestant_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contestants_touch before update on public.contestants
  for each row execute function public.touch_updated_at();
create trigger scores_touch before update on public.scores
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Judges may only score the round that is currently running,
-- and final-round scores only for finalists.
-- ---------------------------------------------------------------------------
create or replace function public.can_score(p_contestant uuid, p_round text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.settings s
    join public.contestants c on c.id = p_contestant
    where s.stage = p_round
      and (p_round = 'round1' or c.is_finalist)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.contestants enable row level security;
alter table public.scores enable row level security;
alter table public.audience_votes enable row level security;
alter table public.audit_log enable row level security;

-- profiles: a user sees their own row, admins see and manage all
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- settings: public read, admin write
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- contestants: public read, admin write
create policy contestants_read on public.contestants for select to anon, authenticated using (true);
create policy contestants_admin_insert on public.contestants for insert to authenticated
  with check (public.is_admin());
create policy contestants_admin_update on public.contestants for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy contestants_admin_delete on public.contestants for delete to authenticated
  using (public.is_admin());

-- scores: judges read/write only their own, only for the live round; admins read all
create policy scores_select on public.scores for select to authenticated
  using (judge_id = auth.uid() or public.is_admin());
create policy scores_judge_insert on public.scores for insert to authenticated
  with check (
    judge_id = auth.uid()
    and public.is_active_judge()
    and public.can_score(contestant_id, round)
  );
create policy scores_judge_update on public.scores for update to authenticated
  using (judge_id = auth.uid() and public.is_active_judge() and public.can_score(contestant_id, round))
  with check (judge_id = auth.uid() and public.can_score(contestant_id, round));
create policy scores_admin_delete on public.scores for delete to authenticated
  using (public.is_admin());

-- audience_votes: no direct access; writes go through cast_vote() from the server
create policy audience_votes_admin_read on public.audience_votes for select to authenticated
  using (public.is_admin());

-- audit_log: admin read; writes happen via log_action()
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());

create or replace function public.log_action(
  p_action text, p_entity text, p_entity_id text, p_details jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  select auth.uid(), p_action, p_entity, p_entity_id, p_details
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Voting (called by the server with the service role only)
-- Returns: 'ok' | 'closed' | 'invalid' | 'already_voted' | 'voter_id_used' | 'voter_id_required'
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_contestant uuid, p_voter_token text, p_voter_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.settings;
  v_category text;
  v_ref text := nullif(trim(p_voter_ref), '');
begin
  select * into v_settings from public.settings where id = 1;
  if v_settings.stage <> 'final' or not v_settings.voting_open then
    return 'closed';
  end if;

  select category into v_category
  from public.contestants
  where id = p_contestant and is_finalist;
  if v_category is null or coalesce(length(p_voter_token), 0) < 16 then
    return 'invalid';
  end if;

  if v_settings.require_voter_id and v_ref is null then
    return 'voter_id_required';
  end if;

  if exists (select 1 from public.audience_votes
             where voter_token = p_voter_token and category = v_category) then
    return 'already_voted';
  end if;

  if v_ref is not null and exists (
    select 1 from public.audience_votes
    where lower(voter_ref) = lower(v_ref) and category = v_category
  ) then
    return 'voter_id_used';
  end if;

  insert into public.audience_votes (contestant_id, category, voter_token, voter_ref)
  values (p_contestant, v_category, p_voter_token, v_ref);
  return 'ok';
exception
  when unique_violation then
    return 'already_voted';
end;
$$;

revoke all on function public.cast_vote(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text) to service_role;

-- Which categories a voter token has already voted in
create or replace function public.voter_status(p_voter_token text)
returns table (category text, contestant_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select category, contestant_id from public.audience_votes where voter_token = p_voter_token;
$$;

revoke all on function public.voter_status(text) from public, anon, authenticated;
grant execute on function public.voter_status(text) to service_role;

-- ---------------------------------------------------------------------------
-- Public leaderboard (aggregates only; individual judge scores stay private)
-- Scores are hidden from the public when settings.show_scores is off,
-- and audience vote counts are hidden while voting is open.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard()
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
  votes int
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
    select contestant_id, count(*) as votes
    from public.audience_votes
    group by contestant_id
  )
  select
    c.id, c.name, c.category, c.department, c.song_round1, c.song_final,
    c.performance_order, c.final_order, c.is_finalist,
    case when s.show_scores or public.is_admin() then round(agg.r1_avg, 2) end,
    case when s.show_scores or public.is_admin() then round(agg.r1_vocal_avg, 2) end,
    coalesce(agg.r1_judges, 0)::int,
    case when s.show_scores or public.is_admin() then round(agg.final_avg, 2) end,
    case when s.show_scores or public.is_admin() then round(agg.final_vocal_avg, 2) end,
    coalesce(agg.final_judges, 0)::int,
    case when (not s.voting_open and s.show_scores) or public.is_admin()
      then coalesce(v.votes, 0)::int end
  from public.contestants c
  cross join s
  left join agg on agg.contestant_id = c.id
  left join v on v.contestant_id = c.id;
$$;

grant execute on function public.leaderboard() to anon, authenticated;

create or replace function public.vote_total()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.audience_votes;
$$;

grant execute on function public.vote_total() to anon, authenticated;

create or replace function public.judge_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where role = 'judge' and active;
$$;

grant execute on function public.judge_count() to anon, authenticated;
