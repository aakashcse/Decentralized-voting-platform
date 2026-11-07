-- Decentralized-voting-platform: off-chain data in Supabase.
-- Votes and vote counts are NEVER stored here. They live only in the smart contract.
-- Run this in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  wallet_address text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Elections (metadata; id matches the on-chain election id)
-- ---------------------------------------------------------------------------
create table if not exists public.elections (
  id bigint primary key,
  title text not null,
  description text,
  banner_url text,
  tx_hash text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Candidate profiles (chain_index = candidate index in the contract)
-- ---------------------------------------------------------------------------
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id bigint not null references public.elections (id) on delete cascade,
  chain_index integer not null check (chain_index >= 0),
  name text not null,
  party text,
  bio text,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (election_id, chain_index)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.elections enable row level security;
alter table public.candidates enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id)
  -- users can't promote themselves to admin
  with check (auth.uid() = id and is_admin = public.is_admin());

drop policy if exists "Anyone reads elections" on public.elections;
create policy "Anyone reads elections" on public.elections for select using (true);

drop policy if exists "Admins write elections" on public.elections;
create policy "Admins write elections" on public.elections
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads candidates" on public.candidates;
create policy "Anyone reads candidates" on public.candidates for select using (true);

drop policy if exists "Admins write candidates" on public.candidates;
create policy "Admins write candidates" on public.candidates
  for all using (public.is_admin()) with check (public.is_admin());

-- To make yourself an admin after signing up:
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
