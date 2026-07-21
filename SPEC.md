# Fantasy Draft Board — Spec

A live draft board for a 12-team home league that runs three sequential
drafts against one shared, shrinking player pool. Replaces Clicky Draft.

The core feature nothing else does: each phase's available-player pool
automatically excludes everyone drafted in the earlier phase(s).

## The three phases, in order

Team lists and roster shapes are **set at the start of each phase**, not
hardcoded — league membership shifts year to year.

1. **MAIN**
   - 12 teams, snake order, ~15 rounds.
   - Standard fantasy roster with configurable slots (e.g. QB, 2×RB, 2×WR,
     TE, FLEX, K, DEF, bench slots).
   - Pool = full player pool.

2. **LEFTOVERS**
   - A subset of the Main teams — usually 8, but configurable at phase
     start (who's in changes year to year).
   - Snake order. No bench — roster is starting slots only.
   - Pool = all players minus everyone drafted in Main.

3. **MICROWAVE**
   - Team list is **also configurable at phase start** — most often the
     same teams as Leftovers, but can be a further subset of that. It is
     *not* assumed to be all 12 Main teams.
   - Snake, 2 rounds only.
   - Roster is exactly 2 slots: one starter (W/R/T flex eligibility) and
     one bench slot.
   - Pool = all players minus everyone drafted in Main minus everyone
     drafted in Leftovers.

After all three phases: generate a combined "fully rostered / ineligible"
player list — reference only, not used for further drafting.

## Users, devices, and access

No user accounts. Two access paths, both without passwords:

- **Commissioner** — a separate, private link/secret (distinct from the
  league code below). Grants the ability to: enter picks on behalf of any
  team, undo the last pick, configure phase team lists and roster slots,
  set snake order, run the pool refresh. Runs on the laptop plugged into
  the TV for the in-person group; the commissioner enters picks called out
  verbally by the room. Nobody in-person needs their own device.

- **Remote drafter** — joins via a link + simple league code, then claims
  a team from a list. Claiming is **per team, not per phase**: once
  someone claims a team (typically during Main), that claim carries
  forward automatically into any later phase that team participates in —
  no re-claiming at the start of Leftovers or Microwave.

Both views stay in sync in real time via Supabase.

## The feel

The league started with a physical sticker draft board; Leftovers got its
name from being drafted out of the leftover stickers. The app should feel
like that: a big, satisfying teams × rounds grid, picks landing as
colored tiles (color-coded by position — e.g. green RB, blue WR, red QB,
yellow TE), a clear "on the clock" indicator. Each phase transition
(Main → Leftovers → Microwave) is a visible moment with a distinct board
treatment per phase — like moving to a different pile of stickers. Fun,
but readable from across a room on a TV.

## Draft mechanics

- Snake order; team order configurable before each phase starts.
- Undo last pick — commissioner only. Non-negotiable; misclicks happen.
- Player search with autocomplete (type-ahead on name), filterable by
  position.
- Best-available-by-position view.
- No pick timer in v1. Pause/resume: a draft must survive a page refresh
  or a break without losing state.
- All state lives server-side in Supabase; any device can drop and
  rejoin without losing anything.

## Player pool

- Sourced from Sleeper's public API
  (`https://api.sleeper.app/v1/players/nfl`), fetched once and cached —
  no live external calls during a draft.
- Default sort by Sleeper's `search_rank` (or equivalent) so best-available
  floats to the top.
- A "refresh pool" command re-pulls current data; run before draft day.

## End-of-phase output

After each phase: a per-team roster checklist, formatted for manual entry
into Yahoo (team by team, in roster-slot order). Plain copy-pasteable
text. This is the only path into Yahoo — **no Yahoo API integration.**

## Stack (decided)

- Next.js, App Router, TypeScript
- Supabase — database + realtime sync
- Deployed on Vercel
- No user accounts — commissioner secret link + league code/team claim
  only

## Explicit non-goals for v1

- No pick timer
- No Yahoo API integration
- No user accounts / passwords
