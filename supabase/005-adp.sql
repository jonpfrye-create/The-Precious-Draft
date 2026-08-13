-- Precious Draft - average draft position
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- ADP comes from Fantasy Football Calculator's free endpoint, aggregated
-- from real 12-team standard mock drafts, and is written onto the pool by
-- `npm run refresh-adp`. It's what tells the room whether a pick is a
-- bargain or a reach.
--
-- Both columns are nullable, and most of the 4254-player pool will keep
-- them null - the feed only covers the ~210 players anyone actually drafts.
-- A sticker with no ADP shows no number rather than a wrong one.

begin;

alter table players
  -- Overall pick number, averaged. 1.6 means "usually gone by the second
  -- pick of round one".
  add column if not exists adp real,
  -- The same thing as round.pick, e.g. "1.02" - which is how everyone in
  -- the room actually talks about it.
  add column if not exists adp_formatted text;

commit;
