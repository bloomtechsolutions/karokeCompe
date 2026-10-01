-- Finalist counts per category (top 5 solo, top 3 duet) and a switch to
-- announce the 1st round results (the finalists) on the TV dashboard.

alter table public.settings
  add column if not exists finalists_solo int not null default 5 check (finalists_solo between 1 and 20),
  add column if not exists finalists_duet int not null default 3 check (finalists_duet between 1 and 20),
  add column if not exists announce_r1 boolean not null default false;

update public.settings set finalists_solo = 5, finalists_duet = 3 where id = 1;
