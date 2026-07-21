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

Project is pre-scaffold as of this writing. `.env.local` already has
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointed at
the live Supabase project. The Next.js app itself, package.json, and
commands below get created in Phase 1 — this section will be filled in
with real `npm run ...` commands once that lands.

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
