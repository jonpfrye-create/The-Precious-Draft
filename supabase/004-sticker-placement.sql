-- Precious Draft - hand-placed sticker positions
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once.
--
-- The commissioner now places each pick by clicking the board, and where
-- they click decides where the sticker sits in its cell. That has to be
-- stored: a placement kept only in the browser would be lost on refresh and
-- would never have existed for anyone else looking at the board, so
-- stickers would appear to jump around by themselves.
--
-- All three columns are nullable. Null means "nobody placed this by hand" -
-- auto-drafted and simulated picks - and those fall back to the tilt
-- derived from the pick id (see src/lib/stickers.ts).

begin;

alter table picks
  -- Offset from the centre of the cell, in percent of the cell's size.
  -- Percent rather than pixels so a sticker lands in the same spot on a TV
  -- and on a laptop.
  add column if not exists placement_x real,
  add column if not exists placement_y real,
  -- Degrees. Derived from how far off-centre the click was, so a deliberate
  -- corner slap comes out more crooked than a careful middle press.
  add column if not exists placement_rotation real;

commit;
