alter table public.habits
  add column if not exists cas_od text,
  add column if not exists cas_do text,
  add column if not exists sport text,
  add column if not exists pocet_opakovani integer,
  add column if not exists vzdalenost numeric,
  add column if not exists sport_typ_01 text,
  add column if not exists sport_typ_02 text,
  add column if not exists sport_typ_03 text,
  add column if not exists sport_typ_04 text,
  add column if not exists sport_typ_05 text,
  add column if not exists sport_typ_06 text,
  add column if not exists sport_typ_07 text,
  add column if not exists sport_typ_08 text,
  add column if not exists sport_typ_09 text,
  add column if not exists sport_typ_10 text,
  add column if not exists pocet_opakovani_01 integer,
  add column if not exists pocet_opakovani_02 integer,
  add column if not exists pocet_opakovani_03 integer,
  add column if not exists pocet_opakovani_04 integer,
  add column if not exists pocet_opakovani_05 integer,
  add column if not exists pocet_opakovani_06 integer,
  add column if not exists pocet_opakovani_07 integer,
  add column if not exists pocet_opakovani_08 integer,
  add column if not exists pocet_opakovani_09 integer,
  add column if not exists pocet_opakovani_10 integer;

alter table public.habits
  drop column if exists sport_2;

grant select, insert, update, delete on table public.habits to anon, authenticated;
