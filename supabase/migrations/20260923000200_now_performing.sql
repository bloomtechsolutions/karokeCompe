-- Performer currently on stage (shown as a spotlight on the TV dashboard).
alter table public.settings
  add column now_performing uuid references public.contestants (id) on delete set null;
