alter table public.habits
  add column if not exists cas_od text,
  add column if not exists cas_do text,
  add column if not exists sport text,
  add column if not exists pocet_opakovani integer,
  add column if not exists vzdalenost numeric;

grant select, insert, update, delete on table public.habits to anon, authenticated;
