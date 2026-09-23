-- Tighten function access flagged by the Supabase security advisor.
-- leaderboard(), vote_total() and judge_count() stay public on purpose.

alter function public.touch_updated_at() set search_path = public;

-- Trigger function: never callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS helpers: needed by signed-in users (policies run as the caller), not by anon.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_judge() from public, anon;
revoke execute on function public.can_score(uuid, text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_judge() to authenticated;
grant execute on function public.can_score(uuid, text) to authenticated;

-- Audit log: only active admins may write entries.
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
  where public.is_admin();
$$;

revoke execute on function public.log_action(text, text, text, jsonb) from public, anon;
grant execute on function public.log_action(text, text, text, jsonb) to authenticated;
