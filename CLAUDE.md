# CLAUDE.md

Project conventions for this repo. See `SPEC.md` for the full product spec.

## What this is

A live draft board web app for a 12-team fantasy football league, running
three sequential drafts (Main → Leftovers → Microwave) against one shared,
shrinking player pool. Full detail in `SPEC.md` — read it before making
product decisions.

## Stack

- **Next.js** (App Router), **TypeScript**
- **Supabase** — Postgres database + Realtime for live sync across devices
- **Vercel** — hosting/deploys
- Package manager: **npm**
- No auth provider — commissioner secret link + league code/team claim,
  no accounts or passwords

## Status

Phase 1 is complete: schema is live in Supabase, snake-order and
pool-exclusion logic are implemented and tested, the Sleeper player pool
has been ingested, and the app is deployed on Vercel (connected to the
`jonpfrye-create/The-Precious-Draft` GitHub repo, auto-deploying on push
to `main`).

Commands:
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm test` — run the Vitest suite (snake-order, pool-exclusion)
- `npm run test:watch` — Vitest in watch mode
- `npm run refresh-pool` — re-pull the current Sleeper player pool and
  upsert into the `players` table (needs `SUPABASE_SERVICE_ROLE_KEY` in
  `.env.local`)

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (the
last one is server-only — never reference it from client-side code; see
`src/lib/supabase/admin.ts` vs `browser.ts`). The same three are set as
environment variables in the Vercel project.

Schema lives in `supabase/schema.sql`, applied by hand via the Supabase
SQL Editor (no migration tool wired up yet — if the schema changes,
that's a new SQL snippet the user runs the same way).

## Locked-in decisions (don't relitigate without asking)

- **Commissioner access is a separate secret/link** from the plain league
  code remote drafters use. The league code only lets someone claim a
  team and pick for that team — it must never grant commissioner powers.
- **Team claims are per-team, not per-phase.** Once claimed, a claim
  persists automatically into any later phase that team is part of. Model
  claims at the team level (not duplicated per phase).
- **Leftovers and Microwave team lists are both configurable at phase
  start** — neither is hardcoded to a fixed 12 or a fixed 8. Microwave's
  team list is usually the same as Leftovers' but can be a further subset.
  Don't assume Microwave = all Main teams.
- **Pool exclusion cascades**: Leftovers excludes Main picks; Microwave
  excludes Main picks *and* Leftovers picks. This logic and snake-order
  math are the highest-risk part of the project — they need automated
  tests, not just manual QA.
- **Undo** only ever undoes the single most recent pick, commissioner-only.
- No Yahoo API integration, ever — end-of-phase output is copy-paste text
  for manual entry.
- No pick timer in v1.

## Working with the user

The user is not a developer. Any step that happens outside Claude Code
(Supabase dashboard, Vercel dashboard, DNS, etc.) must be:
- explained explicitly, one step at a time
- confirmed by the user before moving to the next step

Don't assume familiarity with terms like "migration," "env var," or
"deploy" — say what to click and where.

## Testing

Automated tests are required (not optional) for:
- Snake order generation (all phases, arbitrary team counts)
- Pool exclusion logic (cascading across phases)

Test runner TBD when Phase 1 scaffolds the project — likely Vitest given
the Next.js/TS stack.

## Ideas for later

It’s tradition for me to go through everyone’s teams after the main draft and assign them a letter grade, much like Yahoo does. I’d love to figure out a way to do that.

Furthermore, I’ll be building my own rankings and would love to somehow figure out a way for Claude to use those rankings and give an AI Jon Frye grade and commentary, which would be sort of a magic trick.

Visual idea for the sticker-board feel (Phase 5 polish): stickers on the
physical board never sat quite straight — each pick tile should get a
slight random rotation/offset, not sit in a perfect grid.

Fun detail: back when someone reached for a player who didn't have a
printed sticker, they had to write the name in by hand. So any pick that's
a significant reach above the player's ADP should render in a handwritten
font instead of the normal printed-sticker style. Open question to
resolve before building this: what's the ADP source? Sleeper's
`search_rank` (already ingested) is closest to hand, but isn't quite the
same thing as ADP; may need a real ADP feed or a manually-entered
reference list per the "Yahoo/Sleeper ADP" framing.