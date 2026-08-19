-- Precious Draft - turn on realtime for the draft
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- Everyone drafts from their own phone, so a pick made in someone's hand
-- has to appear on the television and on eleven other phones without
-- anybody refreshing. Supabase only broadcasts changes for tables that
-- have been added to the `supabase_realtime` publication, and no table
-- ever was - so nothing was being broadcast at all.
--
-- Both tables are already `public read` under RLS and hold nothing
-- secret: picks are shown on a television in a room full of people, and
-- a phase is a type, a status and a round count. Realtime respects RLS,
-- so the tables that do hold secrets - league_secrets, team_claims - stay
-- unbroadcast because they have no read policy at all.

begin;

do $$
begin
  -- `add table` errors if the table is already published, which would
  -- make re-running this fail rather than do nothing.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'picks'
  ) then
    alter publication supabase_realtime add table picks;
  end if;

  -- Phases too, so a phone finds out that Main has finished and
  -- Leftovers has started without its owner reloading anything.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'phases'
  ) then
    alter publication supabase_realtime add table phases;
  end if;
end $$;

commit;

-- Confirms it actually took. "Success. No rows returned." looks identical
-- whether this published two tables or did nothing at all, so print the
-- state rather than trusting the message. Expect two rows: picks, phases.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
