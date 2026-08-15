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

## Deadline

**Draft day is Saturday 29 August 2026.** Main, Leftovers and Microwave all
run that day. Anything not working by then doesn't ship — prefer cutting
scope over landing something half-finished close to the date.

## Status

Phase 1 is complete: schema is live in Supabase, snake-order and
pool-exclusion logic are implemented and tested, the Sleeper player pool
has been ingested, and the app is deployed on Vercel (connected to the
`jonpfrye-create/The-Precious-Draft` GitHub repo, auto-deploying on push
to `main`).

Phase 2 is complete: the commissioner draft board runs a Main draft on a
single device.

Commissioner access codes are complete (see "Access control" below).

Commands:
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm test` — run the Vitest suite (snake-order, pool-exclusion, codes)
- `npm run test:watch` — Vitest in watch mode
- `npm run refresh-pool` — re-pull the current Sleeper player pool and
  upsert into the `players` table (needs `SUPABASE_SERVICE_ROLE_KEY` in
  `.env.local`)
- `npm run codes` — print the commissioner link and league code for every
  league, creating them if missing. This is both the bootstrap path and
  the recovery path if the commissioner link is lost.
- `npm run test-league` — create a disposable 12-team league to exercise
  draft mechanics against; `npm run test-league -- --rm` deletes it.
  **Use this rather than the real league** for anything one-shot (see the
  draft order draw below).
- `npm run export-voice` — save every hand-written grade, with the roster
  it was about, to `voice/grade-corpus.json`. Run it after any grading
  session. See "Clams AI" below for why this is not optional.

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (the
last one is server-only — never reference it from client-side code; see
`src/lib/supabase/admin.ts` vs `browser.ts`). The same three are set as
environment variables in the Vercel project.

Schema lives in `supabase/schema.sql`, applied by hand via the Supabase
SQL Editor (no migration tool wired up yet — if the schema changes,
that's a new SQL snippet the user runs the same way).

**Supabase free tier pauses a project after 7 days of no activity**, which
takes the whole app down until it's un-paused from the dashboard (data
survives; restore takes ~3 minutes). This already happened once, in August
2026. The user has chosen to stay on the free tier and un-pause manually —
so **check the project is awake the day before the draft, not on the day.**

## Access control

Codes live in `league_secrets` (RLS-enabled, **zero policies** — only the
service-role key can read them, so the anon key in the browser can never
see a secret).

- `src/lib/auth/codes.ts` — code generation and normalization. Crockford
  base32 (no I/L/O/U) so codes survive being read aloud across a room.
- `src/lib/auth/secrets.ts` — DB access. Deliberately has **no**
  `server-only` import and uses relative imports, because
  `scripts/show-codes.ts` runs it outside Next's bundler.
- `src/lib/auth/commissioner.ts` — the cookie session and the gate.
- `src/app/commish/(protected)/` — route group; its `layout.tsx` gates
  everything inside. Add a new commissioner page here and it's gated.

**The rule that's easy to get wrong:** the `(protected)` layout gates page
*rendering only*. Server actions are separate HTTP endpoints that never run
the layout — an unauthenticated caller who knows the action id can POST to
one directly. So **every commissioner-only server action must call
`requireCommissionerLeagueForAction()` itself**, and then check the phase
it was handed actually belongs to that commissioner's league. Both
`board/actions.ts` actions do this; follow the pattern.

`/commish/setup` sits *outside* the protected group on purpose: on an empty
database no secret exists yet, so requiring one would deadlock the first
run. It uses `checkSetupAccess()` instead — open only while zero leagues
exist, commissioner-only forever after.

The board shows the league code (meant to be shared) but never the
commissioner secret — the board is on a TV in a room full of phones. The
secret lives behind a reveal button on `/commish/access`.

## Draft order draw

Draft order is **not** decided at setup. The order typed in there is an
explicit placeholder; the real order is drawn at `/commish/order` with
everyone watching, because the league won't accept an order the
commissioner generated alone weeks earlier. Rules live in
`src/lib/draft/order-draw.ts`:

- first draw is free
- every later draw needs the phrase `REDRAW` typed in, and the board shows
  the redraw count forever after — redrawing is possible but never quiet
- **once a single pick exists the order is frozen with no override**, since
  redrawing would orphan picks already made

The shuffle runs server-side on purpose. A draw the commissioner's browser
could compute is a draw it could silently retry until it liked the answer.

`phases.order_drawn_at` being null means "still on the placeholder order" —
the board shows a warning in that state. Applied via
`supabase/002-draft-order.sql`.

Draft order is per-phase, so Leftovers and Microwave each get their own
draw through the same page.

## Clams AI

The AI grader. It imitates the commissioner's own grading voice, and the
whole thing rests on two rules that are easy to break by accident.

**1. The corpus is the product, and it is fragile.** `team_grades`
cascades from phases, which cascade from leagues, so
`npm run test-league -- --rm` deletes grades. Hand-written grades are the
only record of how this commissioner grades and cannot be regenerated.
`npm run export-voice` copies them into `voice/grade-corpus.json`, which
is committed. **It merges rather than overwrites** — a plain overwrite
would empty the corpus the first time it ran after the source league was
deleted. Run it after every grading session.

**2. Clams AI must never see the commissioner's grade for the team it is
grading.** `examplesFor()` in `src/lib/ai/corpus.ts` enforces this rather
than trusting callers, because the failure is silent: the key is built
from league name + phase + team, and a mismatch leaks the answer into the
prompt with nothing looking wrong. The keys come from `corpusKey()` on
both sides for exactly this reason.

The grade is **sealed, not just generated**: written early, hidden,
timestamped, revealed on a button. Generating after the commissioner
announces looks like the machine paraphrasing him; showing it before he
speaks makes him a man reacting to a robot. `sealed_at` is the evidence it
came first. Two consequences to preserve:

- an unrevealed grade is **stripped server-side** in `grades/page.tsx` —
  never sent to the browser and hidden with CSS
- RLS on `team_grades` gates AI rows on `revealed_at is not null`, so the
  anon key can't read a sealed grade either (`supabase/007-clams-ai.sql`)
- a revealed grade **cannot be resealed**, or the commissioner could roll
  until he liked the answer

**No model ever does arithmetic.** `src/lib/draft/scouting.ts` computes
reach, value and roster shape, and `describeReport` states them as plain
facts. It is tested to stay neutral — it says "taken 19 picks early",
never "reached". Judgement comes from the examples; one confidently wrong
number in front of the league ends the trick.

Needs `ANTHROPIC_API_KEY` in `.env.local` and in Vercel. Without it the
seal button reports it's not configured and nothing else on the page is
affected.

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
- **Roster slots are not rounds.** Nine slots means nine picks in any
  order; what's enforced is that the finished roster fits. "Only one
  kicker" and "you must end up with one" both fall out of that single
  check — see `src/lib/draft/roster-fit.ts`. Don't special-case positions.
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

Letter grades and Clams AI are both built — see "Clams AI" above.

Still outstanding from that original idea: **the commissioner's own
rankings**. Clams AI currently reasons against consensus ADP, which makes
it a good mimic of his prose but not of his opinions — it can't disagree
with the market the way he does, because it doesn't know where he
disagrees. Feeding in a personal ranking list is the change that would
make it genuinely his rather than a well-imitated voice. Needs a rankings
source first; nothing about the current design blocks it.

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

**Stickers as the core interaction** (requested 13 Aug 2026). The whole
pick flow should feel physical, not like a form: the available-player list
is the *sheet of stickers*, and taking a player should feel like peeling
one off it. Landing on the board should feel like pressing it down — the
tile arrives with weight, slightly askew (see the rotation note above),
and the sheet it came from shows a gap where it used to be. This is the
project's whole reason for existing over Clicky Draft, so it deserves more
than a CSS transition.

**Demo mode for commissioner sign-off** (requested 13 Aug 2026). The user
wants to show the app to the league commissioner and get approval without
manually entering a couple of hundred picks. Needs a way to fast-forward a
draft: auto-pick best-available for every team, ideally with a speed
control and the ability to stop partway so the board can be shown
mid-draft. `scripts/test-league.ts` already builds a throwaway league with
the real team names, so this is most naturally an extension of that (or a
commissioner-only "simulate N picks" button that only ever appears on a
test league — it must never be reachable on the real one).