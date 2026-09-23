-- Audience voting: staff ID + IP checks, attempt log, and per-category gating.

alter table public.audience_votes add column voter_ip text;
create index audience_votes_ip_idx on public.audience_votes (voter_ip, category);

-- Staff ID is required by default; repeat IPs are blocked by default.
alter table public.settings alter column require_voter_id set default true;
update public.settings set require_voter_id = true where id = 1;
alter table public.settings add column block_repeat_ip boolean not null default true;

-- Every rejected vote attempt, for the organiser to review.
create table public.vote_attempts (
  id bigint generated always as identity primary key,
  contestant_id uuid references public.contestants (id) on delete set null,
  category text,
  voter_ref text,
  voter_ip text,
  result text not null,
  created_at timestamptz not null default now()
);
alter table public.vote_attempts enable row level security;
create policy vote_attempts_admin_read on public.vote_attempts for select to authenticated
  using (public.is_admin());

-- A category's voting opens once every finalist in it has performed:
-- scored by at least one judge in the final and no longer on stage.
create or replace function public.category_voting_ready(p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.contestants where category = p_category and is_finalist
    )
    and not exists (
      select 1
      from public.contestants c
      where c.category = p_category
        and c.is_finalist
        and (
          c.id is not distinct from (select now_performing from public.settings where id = 1)
          or not exists (
            select 1 from public.scores s where s.contestant_id = c.id and s.round = 'final'
          )
        )
    );
$$;

revoke all on function public.category_voting_ready(text) from public, anon, authenticated;

drop function public.cast_vote(uuid, text, text);

-- Returns: 'ok' | 'closed' | 'invalid' | 'not_ready' | 'voter_id_required'
--        | 'already_voted' | 'voter_id_used' | 'ip_used'
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
  v_category text;
  v_ref text := nullif(upper(trim(p_voter_ref)), '');
  v_ip text := nullif(trim(p_voter_ip), '');
  v_result text;
begin
  select * into v_settings from public.settings where id = 1;
  select category into v_category from public.contestants where id = p_contestant and is_finalist;

  if v_settings.stage <> 'final' or not v_settings.voting_open then
    v_result := 'closed';
  elsif v_category is null or coalesce(length(p_voter_token), 0) < 16 then
    v_result := 'invalid';
  elsif not public.category_voting_ready(v_category) then
    v_result := 'not_ready';
  elsif v_settings.require_voter_id and v_ref is null then
    v_result := 'voter_id_required';
  else
    -- Serialise votes per category so simultaneous duplicates can't slip through.
    perform pg_advisory_xact_lock(hashtext('vote:' || v_category));
    if exists (select 1 from public.audience_votes
               where voter_token = p_voter_token and category = v_category) then
      v_result := 'already_voted';
    elsif v_ref is not null and exists (select 1 from public.audience_votes
               where lower(voter_ref) = lower(v_ref) and category = v_category) then
      v_result := 'voter_id_used';
    elsif v_settings.block_repeat_ip and v_ip is not null and exists (select 1 from public.audience_votes
               where voter_ip = v_ip and category = v_category) then
      v_result := 'ip_used';
    else
      insert into public.audience_votes (contestant_id, category, voter_token, voter_ref, voter_ip)
      values (p_contestant, v_category, p_voter_token, v_ref, v_ip);
      v_result := 'ok';
    end if;
  end if;

  if v_result <> 'ok' then
    insert into public.vote_attempts (contestant_id, category, voter_ref, voter_ip, result)
    values (p_contestant, v_category, v_ref, v_ip, v_result);
  end if;
  return v_result;
exception
  when unique_violation then
    insert into public.vote_attempts (contestant_id, category, voter_ref, voter_ip, result)
    values (p_contestant, v_category, v_ref, v_ip, 'already_voted');
    return 'already_voted';
end;
$$;

revoke all on function public.cast_vote(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text, text) to service_role;
