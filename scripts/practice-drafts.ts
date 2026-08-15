import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import {
  isValidCommissionerSecretShape,
  isValidLeagueCodeShape,
} from "../src/lib/auth/codes";
import { fetchAllPlayers } from "../src/lib/draft/player-pool";
import {
  draftablePositions,
  forcedPositions,
  type SlotSpec,
} from "../src/lib/draft/roster-fit";

/**
 * Builds a league of deliberately varied drafts for the commissioner to
 * grade, so the corpus has something to learn judgement from.
 *
 * Why this exists: every roster in the corpus so far came from the
 * auto-drafter, which takes the best available player every time. The
 * result is twelve teams whose every pick lands within two of ADP - no
 * reaches, no runs on a position, no bad ideas. Grades written about
 * those teach Clams AI how the commissioner writes and almost nothing
 * about what he rewards or punishes, because nobody did anything he'd
 * object to.
 *
 * Each team here drafts to a different archetype: one ignores running
 * backs, one pays up for a rushing quarterback, one reaches wildly, one
 * does everything by his stated rules. The team names deliberately give
 * nothing away - a team called "Zero RB" would be graded as a label
 * rather than as a roster.
 *
 *   npm run practice-drafts
 *   npm run practice-drafts -- --rm
 */

const DISASTERS = process.argv.includes("--disasters");

const LEAGUE_NAME = DISASTERS ? "ZZZ Disasters" : "ZZZ Practice Drafts";
const LEAGUE_CODE = DISASTERS ? "DSASTR" : "PRACT1";
// Crockford base32 has no I, L, O or U, so codes survive being read
// aloud across a room. normalizeCode turns any I into a 1 on the way in,
// which means a secret spelled "PRACTICE" can never match itself - the
// stored copy keeps the I, the typed copy arrives as a 1. Hence PRACT1CE.
const COMMISSIONER_SECRET = DISASTERS
  ? "D1SASTERD1SASTERD1SASTER55"
  : "PRACT1CEPRACT1CEPRACT1CE77";
const ROUNDS = 14;

const SLOTS: SlotSpec[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { slotName: "DEF", eligiblePositions: ["DEF"] },
  ...Array.from({ length: 6 }, (_, i) => ({
    slotName: `BENCH ${i + 1}`,
    eligiblePositions: ["QB", "RB", "WR", "TE", "K", "DEF"],
  })),
];

const DB_SLOTS = SLOTS.map((s, i) => ({
  slot_order: i + 1,
  slot_name: s.slotName,
  eligible_positions: s.eligiblePositions,
  is_bench: s.slotName.startsWith("BENCH"),
}));

interface Pooled {
  player_id: string;
  full_name: string;
  position: string;
  adp: number;
}

/**
 * How one team drafts.
 *
 * `want` is the positions it reaches for in a given round; `slip` is how
 * far down the remaining board it is willing to look, which is what
 * manufactures a reach. A slip of 0 is best-available discipline; a slip
 * of 30 means happily taking someone up to thirty places down the board
 * because they like him.
 *
 * The slip is an upper bound, not a fixed offset. Used as a fixed offset
 * it means nobody ever takes the best player available - every team steps
 * over him - so the top of the board never gets drafted and the first
 * pick of the draft is still sitting there in round nine.
 */
interface Archetype {
  team: string;
  want: (round: number) => string[];
  slip: (round: number) => number;
}

const ANY = ["QB", "RB", "WR", "TE", "K", "DEF"];

/**
 * The most of each position a real person ends up with.
 *
 * Without these the archetypes produce rosters nobody would ever draft -
 * three defences, nine running backs - and a grade written about those is
 * a grade about the absurdity rather than about the strategy, which
 * teaches the corpus nothing useful.
 */
const MAX_AT: Record<string, number> = {
  QB: 3, RB: 7, WR: 7, TE: 3, K: 1, DEF: 1,
};

const ARCHETYPES: Archetype[] = [
  {
    // Everything by his stated rules: backs early, two receivers inside
    // six, a cheap pocket quarterback, tight end and defense last.
    team: "Gridiron Bakery - Anne",
    want: (r) =>
      r <= 2 ? ["RB"] : r <= 4 ? ["WR"] : r <= 6 ? ["RB", "WR"] :
      r === 7 ? ["QB"] : r <= 11 ? ["RB", "WR", "TE"] :
      r === 12 ? ["TE"] : ["DEF", "K"],
    slip: () => 0,
  },
  {
    // No running back until it is nearly too late.
    team: "Sunday Scaries - Marcus",
    want: (r) =>
      r <= 4 ? ["WR", "TE"] : r <= 6 ? ["WR", "QB"] : ["RB"],
    slip: () => 2,
  },
  {
    // Backs with the first four picks, then scrambling.
    team: "Hand Off Please - Priya",
    want: (r) => (r <= 4 ? ["RB"] : r <= 8 ? ["WR"] : r === 9 ? ["QB"] : ["WR", "TE", "DEF"]),
    slip: () => 1,
  },
  {
    // Pays up early for a quarterback known for running.
    team: "Legs Not Arms - Toby",
    want: (r) => (r <= 1 ? ["RB"] : r === 2 ? ["QB"] : r <= 6 ? ["RB", "WR"] : r <= 11 ? ["WR", "TE"] : ["DEF", "K"]),
    slip: (r) => (r === 2 ? 6 : 1),
  },
  {
    // Two quarterbacks well before anyone needs a second.
    team: "Belt And Braces - Nina",
    want: (r) => (r <= 1 ? ["RB"] : r === 3 || r === 6 ? ["QB"] : r <= 10 ? ["RB", "WR"] : r === 11 ? ["TE"] : ["DEF", "K"]),
    slip: () => 3,
  },
  {
    // Reaches, repeatedly and without embarrassment.
    team: "Gut Feeling - Ray",
    want: (r) => (r <= 2 ? ["RB"] : r <= 6 ? ["WR", "RB"] : r === 7 ? ["QB"] : r <= 11 ? ["WR", "TE", "RB"] : ["DEF", "K"]),
    slip: (r) => (r <= 3 ? 8 : r <= 8 ? 16 : 10),
  },
  {
    // A defence and a kicker long before either is worth anything.
    team: "Special Teams Guy - Dermot",
    want: (r) =>
      r <= 2 ? ["RB"] : r <= 4 ? ["WR"] : r === 5 ? ["DEF"] : r === 7 ? ["K"] :
      r === 8 ? ["QB"] : r <= 12 ? ["RB", "WR", "TE"] : ["WR", "TE"],
    slip: () => 2,
  },
  {
    // Waits on everything, then swings at deep fliers.
    team: "The Long Game - Cassie",
    want: (r) => (r <= 2 ? ["RB", "WR"] : r <= 5 ? ["WR", "RB"] : r <= 8 ? ["RB", "WR", "TE"] : r === 9 ? ["QB"] : ["RB", "WR", "DEF"]),
    slip: (r) => (r >= 9 ? 14 : 3),
  },
  {
    // Premium tight end early, then a conventional build.
    team: "Seam Route - Otis",
    want: (r) => (r <= 1 ? ["RB"] : r === 2 ? ["TE"] : r <= 6 ? ["RB", "WR"] : r === 8 ? ["QB"] : r <= 12 ? ["WR", "RB"] : ["DEF", "K"]),
    slip: () => 1,
  },
  {
    // Textbook shape, but every pick is a player he has said he'd avoid
    // at that price. Tests whether the objection is to the price or the
    // player - he insists it is the price.
    team: "Market Price - Wes",
    want: (r) =>
      r <= 3 ? ["WR"] : r <= 5 ? ["RB"] : r === 6 ? ["QB"] : r <= 11 ? ["WR", "RB", "TE"] : ["DEF", "K"],
    slip: () => 0,
  },
];

/**
 * Rosters with holes in the starting eight.
 *
 * The corpus has exactly one F in it, so the grader has almost no
 * evidence about what the bottom of the scale means and will not go
 * below C no matter how the prompt is worded. These exist to be graded
 * badly. Each leaves at least four of QB/RB/RB/WR/WR/TE/FLEX/DEF filled
 * by someone nobody would start.
 */
const DISASTER_SET: Archetype[] = [
  {
    // Eight straight receivers, then everything else from the scrap heap.
    team: "All Eggs One Basket - Fergus",
    want: (r) =>
      r <= 8 ? ["WR"] : r === 9 ? ["QB"] : r <= 11 ? ["RB"] :
      r === 12 ? ["TE"] : ["DEF", "K"],
    slip: () => 0,
  },
  {
    // A defence in the second round and a kicker in the third, which
    // costs the two picks that would have been actual starters.
    team: "Units And Specials - Bev",
    want: (r) =>
      r === 1 ? ["RB"] : r === 2 ? ["DEF"] : r === 3 ? ["K"] :
      r <= 7 ? ["WR"] : r <= 10 ? ["RB"] : r === 11 ? ["QB"] :
      r === 12 ? ["TE"] : ["WR", "RB"],
    slip: () => 6,
  },
  {
    // Reaches so far ahead of the board that every starter is a player
    // who should have been available seventy picks later.
    team: "Trust The Process - Hal",
    want: (r) =>
      r <= 3 ? ["RB", "WR"] : r === 4 ? ["QB"] : r <= 8 ? ["WR", "RB"] :
      r === 9 ? ["TE"] : r <= 12 ? ["RB", "WR"] : ["DEF", "K"],
    slip: (r) => (r <= 9 ? 40 : 8),
  },
  // Ordinary teams, so the draft board around the disasters behaves and
  // the pick numbers mean something.
  ...["Kerbside Pickup - Ines", "Fourth And Long - Ola", "Bootleg Right - Sam",
      "Playaction Pete - Ivo", "Nickel Package - Wren", "Hurry Up Offence - Gus",
      "Cover Two - Mira", "Zone Read - Ada", "Hail Mary - Fitz"].map((team) => ({
    team,
    want: (r: number) =>
      r <= 2 ? ["RB", "WR"] : r <= 5 ? ["WR", "RB"] : r === 6 ? ["QB"] :
      r <= 10 ? ["RB", "WR", "TE"] : r === 11 ? ["TE"] : ["DEF", "K"],
    slip: () => 1,
  })),
];

const SET: Archetype[] = DISASTERS ? DISASTER_SET : ARCHETYPES;

/**
 * A repeatable offset in [0, range). Deterministic so two runs of this
 * script produce the same league, which matters when the commissioner is
 * part-way through grading one.
 */
function jitter(pickIndex: number, teamIndex: number, range: number): number {
  let h = 2166136261 ^ pickIndex;
  h = Math.imul(h ^ teamIndex, 16777619);
  h = Math.imul(h ^ (h >>> 13), 16777619);
  return ((h >>> 8) >>> 0) % range;
}

function snakeOrder(teams: number, rounds: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < teams; i++) {
      order.push(r % 2 === 0 ? i : teams - 1 - i);
    }
  }
  return order;
}

async function remove() {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("leagues").select("id").eq("name", LEAGUE_NAME);
  if (!data?.length) {
    console.log(`No "${LEAGUE_NAME}" to remove.`);
    return;
  }
  const { error } = await supabase.from("leagues").delete().eq("name", LEAGUE_NAME);
  if (error) throw error;
  console.log(`Removed "${LEAGUE_NAME}" and everything it owned.`);
}

async function create() {
  const supabase = createAdminSupabaseClient();

  // Fail here rather than after writing a league nobody can sign into.
  if (!isValidLeagueCodeShape(LEAGUE_CODE)) {
    throw new Error(`League code "${LEAGUE_CODE}" is not a valid code shape.`);
  }
  if (!isValidCommissionerSecretShape(COMMISSIONER_SECRET)) {
    throw new Error(
      `Commissioner secret "${COMMISSIONER_SECRET}" is not a valid code shape - ` +
        `Crockford base32 excludes I, L, O and U.`
    );
  }

  const { data: existing } = await supabase
    .from("leagues").select("id").eq("name", LEAGUE_NAME);
  if (existing?.length) {
    console.log(`"${LEAGUE_NAME}" already exists. Run with --rm first.`);
    return;
  }

  const all = await fetchAllPlayers(supabase);
  const pool: Pooled[] = all
    .filter((p): p is typeof p & { position: string; adp: number } =>
      p.adp !== null && p.position !== null)
    .map((p) => ({
      player_id: p.player_id, full_name: p.full_name,
      position: p.position, adp: p.adp,
    }))
    .sort((a, b) => a.adp - b.adp);

  console.log(`Pool: ${pool.length} players with an ADP`);
  if (pool.length < SET.length * ROUNDS) {
    throw new Error("Not enough players with an ADP to fill these rosters.");
  }

  const rosters: Pooled[][] = SET.map(() => []);
  const taken = new Set<string>();
  const order = snakeOrder(SET.length, ROUNDS);
  const picks: { team: number; player: Pooled; pickNumber: number; round: number }[] = [];

  order.forEach((teamIndex, i) => {
    const round = Math.floor(i / SET.length) + 1;
    const archetype = SET[teamIndex];
    const roster = rosters[teamIndex];
    const held = roster.map((p) => p.position);
    const available = pool.filter((p) => !taken.has(p.player_id));

    // Whatever the archetype wants, the roster still has to be legal - so
    // a forced position always wins. This is the same check the board
    // uses to refuse an illegal pick.
    const forced = forcedPositions(held, SLOTS, ANY);
    const legal = draftablePositions(held, SLOTS, ANY);
    let wanted = forced.length ? forced : archetype.want(round);
    wanted = wanted.filter((p) => legal.includes(p));
    if (!wanted.length) wanted = legal;

    const held_count = (pos: string) => held.filter((h) => h === pos).length;
    const underCap = (p: Pooled) => held_count(p.position) < (MAX_AT[p.position] ?? 99);

    const candidates = available.filter(
      (p) => wanted.includes(p.position) && underCap(p)
    );
    const usable = candidates.length
      ? candidates
      : available.filter((p) => legal.includes(p.position) && underCap(p));
    if (!usable.length) throw new Error(`Nothing legal for ${archetype.team} in round ${round}`);

    // The slip is what turns a preference into a reach: rather than the
    // best player left at the position, take one further down the board.
    // Jittered within the bound so the board actually drains from the top.
    const bound = Math.min(archetype.slip(round), usable.length - 1);
    const player = usable[bound === 0 ? 0 : jitter(i, teamIndex, bound + 1)];

    taken.add(player.player_id);
    roster.push(player);
    picks.push({ team: teamIndex, player, pickNumber: i + 1, round });
  });

  const { data: league, error: leagueError } = await supabase
    .from("leagues").insert({ name: LEAGUE_NAME }).select("id").single();
  if (leagueError) throw leagueError;

  const { error: secretError } = await supabase.from("league_secrets").insert({
    league_id: league.id,
    league_code: LEAGUE_CODE,
    commissioner_secret: COMMISSIONER_SECRET,
  });
  if (secretError) throw secretError;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .insert(SET.map((a) => ({ league_id: league.id, name: a.team })))
    .select("id, name");
  if (teamsError) throw teamsError;
  const teamId = SET.map(
    (a) => teams!.find((t) => t.name === a.team)!.id
  );

  const { data: phase, error: phaseError } = await supabase
    .from("phases").insert({
      league_id: league.id, type: "main", sequence: 1, status: "completed",
      rounds: ROUNDS,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      order_drawn_at: new Date().toISOString(),
      order_draw_count: 1,
      order_revealed_count: SET.length,
    }).select("id").single();
  if (phaseError) throw phaseError;

  const { error: ptError } = await supabase.from("phase_teams").insert(
    teamId.map((id, i) => ({
      phase_id: phase.id, team_id: id, draft_position: i + 1, revealed: true,
    }))
  );
  if (ptError) throw ptError;

  const { error: slotError } = await supabase.from("roster_slots").insert(
    DB_SLOTS.map((s) => ({ phase_id: phase.id, ...s }))
  );
  if (slotError) throw slotError;

  const { error: pickError } = await supabase.from("picks").insert(
    picks.map((p) => ({
      phase_id: phase.id, team_id: teamId[p.team], player_id: p.player.player_id,
      pick_number: p.pickNumber, round: p.round,
    }))
  );
  if (pickError) throw pickError;

  console.log(`\nCreated "${LEAGUE_NAME}" - ${SET.length} teams, ${picks.length} picks\n`);
  SET.forEach((a, i) => {
    const r = rosters[i];
    const worst = picks
      .filter((p) => p.team === i)
      .map((p) => ({ n: p.player.full_name, d: p.player.adp - p.pickNumber }))
      .sort((x, y) => y.d - x.d)[0];
    const shape = ["QB", "RB", "WR", "TE", "DEF", "K"]
      .map((pos) => `${r.filter((p) => p.position === pos).length}${pos}`)
      .filter((s) => !s.startsWith("0"))
      .join(" ");
    console.log(
      `  ${a.team.padEnd(28)} ${shape.padEnd(26)} biggest reach: ${worst.n} (+${worst.d.toFixed(0)})`
    );
  });
  console.log(`\n  Commissioner link: /commish/enter?secret=${COMMISSIONER_SECRET}`);
}

const main = process.argv.includes("--rm") ? remove : create;
main().catch((e) => { console.error(e); process.exit(1); });
