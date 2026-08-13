-- Precious Draft - draft order draw tracking
--
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run more than once: every statement uses "if not exists", so a
-- second run changes nothing rather than erroring.
--
-- Adds the bookkeeping behind the draft-order draw. The order itself
-- already lives in phase_teams.draft_position; what's missing is the
-- evidence of *how* it got there, which is what makes a redraw impossible
-- to do quietly.

begin;

alter table phases
  -- When the order was last drawn. Null means "never drawn" - the phase is
  -- still sitting on the placeholder order typed in at setup, and the board
  -- should say so rather than implying the order is real.
  add column if not exists order_drawn_at timestamptz,
  -- How many times it has been drawn. Displayed on the board whenever it's
  -- above 1, so a redraw is always visible to the room. Never decremented.
  add column if not exists order_draw_count int not null default 0;

commit;
