-- Precious Draft - released players, and draft grades
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.

begin;

-- Releasing a player back into the pool ---------------------------------
--
-- Leftovers gives every team a QB slot, but Main has already picked the
-- pool over. If there aren't enough quarterbacks left for everyone
-- staying, this league releases the last one taken in Main back into the
-- pool so nobody starts the season without one.
--
-- The team that drafted him KEEPS him: Main and Leftovers are separate
-- Yahoo leagues, so the same player appearing in both is fine, and no
-- single roster ends up with him twice. That's why this is a flag on the
-- pick rather than a deletion - his Main roster line and the Main export
-- are untouched, he simply stops being excluded from later phases.
alter table picks
  add column if not exists released_at timestamptz;

-- Draft grades ----------------------------------------------------------
--
-- Tradition: after the Main draft every team gets a letter grade. Stored
-- per phase and per source, so a commissioner grade and a generated one
-- can sit side by side later rather than overwriting each other.
create table if not exists team_grades (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  -- 'commissioner' today; 'ai' is the one that comes later.
  source text not null default 'commissioner',
  grade text not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One grade per team per phase per source, so saving twice updates
  -- rather than piling up duplicates.
  unique (phase_id, team_id, source)
);

alter table team_grades enable row level security;

-- Readable with the anon key like the rest of the draft, so grades can be
-- shown to the league later. Writes go through the service-role key in
-- server actions, same as picks.
create policy "public read" on team_grades for select using (true);

commit;
