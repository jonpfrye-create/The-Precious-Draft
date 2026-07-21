-- Precious Draft - initial schema
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Wrapped in a transaction so a mid-script error rolls back cleanly instead
-- of leaving a half-created schema behind.

begin;

create extension if not exists pgcrypto;

-- Leagues: public-readable, no secrets here.
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Secrets live in their own table with NO public RLS policies below.
-- Only the service-role key (used exclusively in server-side code, never
-- shipped to the browser) can read or write this table. Keeping secrets
-- out of the publicly-readable leagues table is what stops a remote
-- drafter from reading the commissioner secret straight out of the
-- Supabase REST API with just the anon key.
create table league_secrets (
  league_id uuid primary key references leagues(id) on delete cascade,
  league_code text not null unique,
  commissioner_secret text not null unique
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- A claim token lets a browser act as a given team (make its picks). It
-- is a secret in the same sense as commissioner_secret, so it gets the
-- same no-public-policy treatment as league_secrets. One claim per team
-- ever, since claims persist across phases (see CLAUDE.md) - there is no
-- per-phase claim row.
create table team_claims (
  team_id uuid primary key references teams(id) on delete cascade,
  claim_token text not null unique,
  claimed_at timestamptz not null default now()
);

create table phases (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  type text not null check (type in ('main', 'leftovers', 'microwave')),
  -- Sequence drives pool exclusion: a phase excludes players picked in
  -- every phase with a lower sequence number in the same league. Using a
  -- number instead of hardcoding phase names keeps exclusion logic
  -- generic (see src/lib/draft/pool-exclusion.ts).
  sequence int not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'completed')),
  rounds int not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (league_id, sequence)
);

-- Which teams participate in a given phase, and their snake draft
-- position. Kept separate from teams because Leftovers and Microwave
-- both use configurable subsets of the full team list, decided at phase
-- start - neither is hardcoded to a fixed team count.
create table phase_teams (
  phase_id uuid not null references phases(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  draft_position int not null,
  primary key (phase_id, team_id),
  unique (phase_id, draft_position)
);

-- Configurable roster shape per phase (Main has bench slots, Leftovers
-- has none, Microwave is exactly one flex plus one bench).
create table roster_slots (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  slot_order int not null,
  slot_name text not null,
  eligible_positions text[] not null,
  is_bench boolean not null default false,
  unique (phase_id, slot_order)
);

-- Master player pool, ingested from Sleeper (see scripts/ingest-players.ts).
-- Re-running the ingest upserts by player_id, so a refresh-pool run
-- before draft day is idempotent.
create table players (
  player_id text primary key,
  full_name text not null,
  position text,
  nfl_team text,
  search_rank int,
  status text,
  updated_at timestamptz not null default now()
);

create table picks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id text not null references players(player_id),
  pick_number int not null,
  round int not null,
  picked_at timestamptz not null default now(),
  unique (phase_id, pick_number),
  unique (phase_id, player_id)
);

-- Row-Level Security -----------------------------------------------------
-- Everything below is readable with the anon key so the board can sync in
-- realtime across devices. None of it is secret. All writes (making
-- picks, undo, configuring phases, ingesting players) go through
-- server-side API routes using the service-role key, which bypasses RLS
-- entirely - so there are intentionally no insert/update/delete policies
-- below. league_secrets and team_claims get RLS enabled with zero
-- policies, so the anon key cannot read or write them under any
-- circumstance.

alter table leagues enable row level security;
alter table teams enable row level security;
alter table phases enable row level security;
alter table phase_teams enable row level security;
alter table roster_slots enable row level security;
alter table players enable row level security;
alter table picks enable row level security;

create policy "public read" on leagues for select using (true);
create policy "public read" on teams for select using (true);
create policy "public read" on phases for select using (true);
create policy "public read" on phase_teams for select using (true);
create policy "public read" on roster_slots for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on picks for select using (true);

alter table league_secrets enable row level security;
alter table team_claims enable row level security;

commit;
