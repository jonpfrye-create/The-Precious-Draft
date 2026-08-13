-- Precious Draft - click-by-click draft order reveal
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- Moves the reveal out of the commissioner's browser and into the database.
-- That's what lets other screens follow along later: when live sync arrives,
-- a spectator page just watches these rows change. It also closes a leak -
-- phase_teams was world-readable, so anyone could have pulled the full draft
-- order out of the public API before it was revealed on the TV.

begin;

alter table phases
  -- How many draft positions have been revealed so far, counted from the
  -- last pick upwards. 0 = drawn but nothing shown yet.
  add column if not exists order_revealed_count int not null default 0;

alter table phase_teams
  -- Whether this row's draft position may be shown publicly yet. Defaults
  -- to true so every existing row - and any phase that never uses the
  -- reveal - keeps behaving exactly as before.
  add column if not exists revealed boolean not null default true;

-- Replace the blanket public-read policy with one that only exposes
-- positions that have actually been revealed. Server-side code uses the
-- service-role key, which bypasses RLS entirely, so the commissioner's own
-- board is unaffected and still sees the full order.
drop policy if exists "public read" on phase_teams;
create policy "public read revealed" on phase_teams
  for select using (revealed);

commit;
