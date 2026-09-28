-- Show each finalist's audience vote count live on the public dashboard
-- (previously hidden until voting closed). Still hidden when show_scores is off.
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
    case when s.show_scores or public.is_admin() then coalesce(v.votes, 0)::int end
  from public.contestants c
  cross join s
  left join agg on agg.contestant_id = c.id
  left join v on v.contestant_id = c.id;
$$;
