-- Remember who was last called to the stage, so "up next" follows the running
-- order even after the stage is cleared and before judges have scored.
alter table public.settings
  add column if not exists last_on_stage uuid references public.contestants(id) on delete set null;

create or replace function public.track_last_on_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    new.last_on_stage := null;
  end if;
  if new.now_performing is not null then
    new.last_on_stage := new.now_performing;
  end if;
  return new;
end;
$$;

drop trigger if exists settings_track_last_on_stage on public.settings;
create trigger settings_track_last_on_stage
  before update on public.settings
  for each row execute function public.track_last_on_stage();

update public.settings set last_on_stage = now_performing where id = 1;
