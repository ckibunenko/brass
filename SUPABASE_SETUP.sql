-- Run this in Supabase SQL Editor.
-- Replace OWNER_EMAIL_HERE with your real owner email before running.

create extension if not exists pgcrypto;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  first_place text not null check (first_place in ('Sveta', 'Aca', 'Peca', 'Bucki')),
  second_place text not null check (second_place in ('Sveta', 'Aca', 'Peca', 'Bucki')),
  third_place text not null check (third_place in ('Sveta', 'Aca', 'Peca', 'Bucki')),
  fourth_place text not null check (fourth_place in ('Sveta', 'Aca', 'Peca', 'Bucki')),
  created_at timestamptz not null default now(),
  constraint unique_players_per_match check (
    first_place <> second_place and
    first_place <> third_place and
    first_place <> fourth_place and
    second_place <> third_place and
    second_place <> fourth_place and
    third_place <> fourth_place
  )
);

alter table public.matches enable row level security;

drop policy if exists matches_public_read on public.matches;
create policy matches_public_read
on public.matches
for select
using (true);

drop policy if exists matches_owner_insert on public.matches;
create policy matches_owner_insert
on public.matches
for insert
with check ((auth.jwt() ->> 'email') = 'OWNER_EMAIL_HERE');

drop policy if exists matches_owner_update on public.matches;
create policy matches_owner_update
on public.matches
for update
using ((auth.jwt() ->> 'email') = 'OWNER_EMAIL_HERE')
with check ((auth.jwt() ->> 'email') = 'OWNER_EMAIL_HERE');

drop policy if exists matches_owner_delete on public.matches;
create policy matches_owner_delete
on public.matches
for delete
using ((auth.jwt() ->> 'email') = 'OWNER_EMAIL_HERE');
