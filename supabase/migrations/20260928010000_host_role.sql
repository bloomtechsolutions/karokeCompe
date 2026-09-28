-- Host role: the MC reads out who's next and can call performers to the stage.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('judge', 'admin', 'host'));

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
    case when new.raw_app_meta_data ->> 'role' in ('admin', 'host') then new.raw_app_meta_data ->> 'role' else 'judge' end,
    coalesce(new.raw_app_meta_data ->> 'role', '') in ('judge', 'admin', 'host')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Host or organiser (organisers can do everything a host can).
create or replace function public.is_host()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('host', 'admin') and active
  );
$$;

revoke execute on function public.is_host() from public, anon;
grant execute on function public.is_host() to authenticated;

-- Put a performer on stage (or clear it with null). Hosts and organisers only.
create or replace function public.host_set_on_stage(p_contestant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_host() then
    raise exception 'Only the host or organiser can change who is on stage' using errcode = '42501';
  end if;
  update public.settings set now_performing = p_contestant where id = 1;
end;
$$;

revoke execute on function public.host_set_on_stage(uuid) from public, anon;
grant execute on function public.host_set_on_stage(uuid) to authenticated;

-- Hosts see the same scores as organisers (e.g. to announce winners while
-- public scores are hidden).
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
    case when s.show_scores or public.is_host() then round(agg.r1_avg, 2) end,
    case when s.show_scores or public.is_host() then round(agg.r1_vocal_avg, 2) end,
    coalesce(agg.r1_judges, 0)::int,
    case when s.show_scores or public.is_host() then round(agg.final_avg, 2) end,
    case when s.show_scores or public.is_host() then round(agg.final_vocal_avg, 2) end,
    coalesce(agg.final_judges, 0)::int,
    case when s.show_scores or public.is_host() then coalesce(v.votes, 0)::int end
  from public.contestants c
  cross join s
  left join agg on agg.contestant_id = c.id
  left join v on v.contestant_id = c.id;
$$;
