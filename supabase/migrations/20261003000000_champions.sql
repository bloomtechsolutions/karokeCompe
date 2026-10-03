-- Champions: after the final, each judge picks a champion per category from
-- the standings (judges' scores + audience votes). The organiser confirms
-- the champion of each category and uploads their photo for the TV.

-- ---------------------------------------------------------------------------
-- Judges' picks (one per judge per category)
-- ---------------------------------------------------------------------------
create table if not exists public.champion_picks (
  judge_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('solo', 'duet')),
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (judge_id, category)
);

alter table public.champion_picks enable row level security;

-- A judge may pick a finalist of that category, during the final, once voting is closed.
create or replace function public.can_pick_champion(p_category text, p_contestant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_judge()
    and exists (select 1 from public.settings where id = 1 and stage = 'final' and not voting_open)
    and exists (select 1 from public.contestants
                where id = p_contestant and category = p_category and is_finalist);
$$;

revoke all on function public.can_pick_champion(text, uuid) from public, anon;
grant execute on function public.can_pick_champion(text, uuid) to authenticated;

create policy champion_picks_read on public.champion_picks for select to authenticated
  using (judge_id = auth.uid() or public.is_host());
create policy champion_picks_insert on public.champion_picks for insert to authenticated
  with check (judge_id = auth.uid() and public.can_pick_champion(category, contestant_id));
create policy champion_picks_update on public.champion_picks for update to authenticated
  using (judge_id = auth.uid())
  with check (judge_id = auth.uid() and public.can_pick_champion(category, contestant_id));

-- ---------------------------------------------------------------------------
-- Confirmed champions (one per category), with a photo for the TV
-- ---------------------------------------------------------------------------
create table if not exists public.champions (
  category text primary key check (category in ('solo', 'duet')),
  contestant_id uuid references public.contestants (id) on delete set null,
  photo_url text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz not null default now()
);

alter table public.champions enable row level security;

-- Public only once the competition is completed (the reveal); host/organiser always.
-- (anon can't call is_host(), so it gets its own policy.)
create policy champions_read on public.champions for select to authenticated
  using (
    exists (select 1 from public.settings where id = 1 and stage = 'completed')
    or public.is_host()
  );
create policy champions_read_public on public.champions for select to anon
  using (exists (select 1 from public.settings where id = 1 and stage = 'completed'));
create policy champions_admin_write on public.champions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Final standings for judges (scores stay hidden from the public dashboard)
-- ---------------------------------------------------------------------------
create or replace function public.final_standings()
returns table (
  contestant_id uuid,
  category text,
  name text,
  final_avg numeric,
  final_vocal_avg numeric,
  final_judges int,
  votes int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_active_judge() or public.is_host()) then
    raise exception 'Only judges and the organiser can see the final standings' using errcode = '42501';
  end if;
  return query
    select c.id, c.category, c.name,
      round(avg(s.total), 2), round(avg(s.vocal), 2), count(s.id)::int,
      (select count(*)::int from public.audience_votes v where v.contestant_id = c.id and v.round = 'final')
    from public.contestants c
    left join public.scores s on s.contestant_id = c.id and s.round = 'final'
    where c.is_finalist
    group by c.id;
end;
$$;

revoke all on function public.final_standings() from public, anon;
grant execute on function public.final_standings() to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage (public bucket; uploads go through the server with the service role)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('winners', 'winners', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Duets: a second photo (one per singer). One photo of the pair also works.
alter table public.champions add column if not exists photo_url_2 text;
