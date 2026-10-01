-- Venue check-in: a check-in desk account enters the staff IDs of people at
-- the venue, and (when settings.require_checkin is on) only those staff IDs
-- can vote. Voting rules are otherwise unchanged.

-- ---------------------------------------------------------------------------
-- Check-in role
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('judge', 'admin', 'host', 'checkin'));

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
    case when new.raw_app_meta_data ->> 'role' in ('admin', 'host', 'checkin')
      then new.raw_app_meta_data ->> 'role' else 'judge' end,
    coalesce(new.raw_app_meta_data ->> 'role', '') in ('judge', 'admin', 'host', 'checkin')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Check-in desk or organiser.
create or replace function public.is_checkin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('checkin', 'admin') and active
  );
$$;

revoke execute on function public.is_checkin() from public, anon;
grant execute on function public.is_checkin() to authenticated;

-- ---------------------------------------------------------------------------
-- Staff at the venue
-- ---------------------------------------------------------------------------
create table if not exists public.venue_staff (
  staff_id text primary key check (staff_id = upper(trim(staff_id)) and length(staff_id) between 1 and 30),
  name text,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.venue_staff enable row level security;
create policy venue_staff_read on public.venue_staff for select to authenticated using (public.is_checkin());
create policy venue_staff_insert on public.venue_staff for insert to authenticated with check (public.is_checkin());
create policy venue_staff_update on public.venue_staff for update to authenticated
  using (public.is_checkin()) with check (public.is_checkin());
create policy venue_staff_delete on public.venue_staff for delete to authenticated using (public.is_checkin());

alter table public.settings add column if not exists require_checkin boolean not null default true;

-- ---------------------------------------------------------------------------
-- cast_vote: only checked-in staff IDs may vote (when required)
-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'voter_id_required'
--        | 'not_checked_in' | 'already_voted' | 'voter_id_used' | 'ip_used'
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
