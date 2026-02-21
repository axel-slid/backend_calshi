-- Run this in Supabase SQL editor.
-- Creates tables for anonymous market suggestions + voting.

create extension if not exists pgcrypto;

create table if not exists public.market_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  details text not null default ''
);

create index if not exists market_suggestions_created_at_idx
  on public.market_suggestions (created_at desc);

create table if not exists public.market_suggestion_votes (
  suggestion_id uuid not null references public.market_suggestions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  value smallint not null,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id),
  constraint market_suggestion_votes_value_chk check (value in (-1, 1))
);

create index if not exists market_suggestion_votes_suggestion_idx
  on public.market_suggestion_votes (suggestion_id);

-- Optional (recommended): enable RLS so if you ever query directly from client,
-- users can only see public fields and can only vote once per suggestion.
alter table public.market_suggestions enable row level security;
alter table public.market_suggestion_votes enable row level security;

-- Read suggestions (public)
drop policy if exists "public can read suggestions" on public.market_suggestions;
create policy "public can read suggestions"
  on public.market_suggestions
  for select
  to anon, authenticated
  using (true);

-- Create suggestion (authenticated)
drop policy if exists "authed can create suggestions" on public.market_suggestions;
create policy "authed can create suggestions"
  on public.market_suggestions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Read votes (public)
drop policy if exists "public can read suggestion votes" on public.market_suggestion_votes;
create policy "public can read suggestion votes"
  on public.market_suggestion_votes
  for select
  to anon, authenticated
  using (true);

-- Vote (authenticated)
drop policy if exists "authed can upsert their vote" on public.market_suggestion_votes;
create policy "authed can upsert their vote"
  on public.market_suggestion_votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "authed can update their vote" on public.market_suggestion_votes;
create policy "authed can update their vote"
  on public.market_suggestion_votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "authed can delete their vote" on public.market_suggestion_votes;
create policy "authed can delete their vote"
  on public.market_suggestion_votes
  for delete
  to authenticated
  using (auth.uid() = user_id);
