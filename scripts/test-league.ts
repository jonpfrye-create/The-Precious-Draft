import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";

// Creates (or removes) a disposable league for exercising draft mechanics
// against a real database without touching the real league.
//
//   npm run test-league          create it, print the commissioner link
//   npm run test-league -- --rm  delete it and everything it owns
//
// Why this exists: things like the draft-order draw are one-shot by
// design - drawing on the real league would burn the "never drawn yet"
// state that draft day depends on. So they get exercised here instead.

// Demo leagues are recognised by the "ZZZ " prefix (see
// lib/draft/auto-pick.ts), so more than one can exist - the commissioner
// gets his own to poke at without resetting anyone else's.
//
//   npm run test-league -- --name "ZZZ Commish Demo"
const DEFAULT_LEAGUE_NAME = "ZZZ Draw Test";

function requestedName(): string {
  const index = process.argv.indexOf("--name");
  if (index === -1) return DEFAULT_LEAGUE_NAME;
  const value = process.argv[index + 1];
  if (!value) return DEFAULT_LEAGUE_NAME;
  if (!value.startsWith("ZZZ ")) {
    console.error(
      `Demo league names must start with "ZZZ " so the demo tools can tell ` +
        `them apart from a real draft. Got: ${value}`
    );
    process.exit(1);
  }
  return value;
}

const LEAGUE_NAME = requestedName();

// The point of the throwaway league is to rehearse the real thing, so it
// mirrors the real league: its team names (twelve names of realistic length
// are what actually test whether the reveal reads from across a room -
// "Test Team 07" does not) and its round count (which drives how many pick
// numbers land on the reveal card).
interface BorrowedSlot {
  slot_name: string;
  eligible_positions: string[];
  is_bench: boolean;
}

interface BorrowedLeague {
  names: string[];
  rounds: number | null;
  slots: BorrowedSlot[];
}

async function borrowFromRealLeague(): Promise<BorrowedLeague | null> {
  const supabase = createAdminSupabaseClient();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name")
    .not("name", "like", "ZZZ %")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!leagues || leagues.length === 0) return null;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("name")
    .eq("league_id", leagues[0].id);
  if (teamsError) throw teamsError;
  if (!teams || teams.length === 0) return null;

  const { data: phases, error: phasesError } = await supabase
    .from("phases")
    .select("id, rounds")
    .eq("league_id", leagues[0].id)
    .order("sequence", { ascending: true })
    .limit(1);
  if (phasesError) throw phasesError;

  // Roster slots matter as much as the names: without them nothing can be
  // drafted at all, because every pick has to land in an eligible slot.
  let slots: BorrowedSlot[] = [];
  if (phases?.[0]?.id) {
    const { data: slotRows, error: slotsError } = await supabase
      .from("roster_slots")
      .select("slot_name, eligible_positions, is_bench")
      .eq("phase_id", phases[0].id)
      .order("slot_order", { ascending: true });
    if (slotsError) throw slotsError;
    slots = (slotRows ?? []) as BorrowedSlot[];
  }

  return {
    names: teams.map((t) => t.name),
    rounds: phases?.[0]?.rounds ?? null,
    slots,
  };
}

// Used when there's no real league to copy from.
const FALLBACK_SLOTS: BorrowedSlot[] = [
  { slot_name: "QB", eligible_positions: ["QB"], is_bench: false },
  { slot_name: "RB1", eligible_positions: ["RB"], is_bench: false },
  { slot_name: "RB2", eligible_positions: ["RB"], is_bench: false },
  { slot_name: "WR1", eligible_positions: ["WR"], is_bench: false },
  { slot_name: "WR2", eligible_positions: ["WR"], is_bench: false },
  { slot_name: "TE", eligible_positions: ["TE"], is_bench: false },
  { slot_name: "FLEX", eligible_positions: ["RB", "WR", "TE"], is_bench: false },
  { slot_name: "DEF", eligible_positions: ["DEF"], is_bench: false },
  ...Array.from({ length: 6 }, (_, i) => ({
    slot_name: `BENCH ${i + 1}`,
    eligible_positions: ["QB", "RB", "WR", "TE", "K", "DEF"],
    is_bench: true,
  })),
];

// Fixed for the default league so re-running is predictable, and derived
// for any other so two demo leagues can coexist - both code columns are
// UNIQUE. Valid code shapes (Crockford base32, no I/L/O/U) so they behave
// exactly like generated ones.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function codeFromName(name: string, length: number, salt: string): string {
  let hash = 2166136261;
  for (const char of `${salt}:${name}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 16777619);
    out += ALPHABET[(hash >>> 8) % ALPHABET.length];
  }
  return out;
}

const isDefaultLeague = LEAGUE_NAME === DEFAULT_LEAGUE_NAME;
const LEAGUE_CODE = isDefaultLeague
  ? "TESTAA"
  : codeFromName(LEAGUE_NAME, 6, "code");
const COMMISSIONER_SECRET = isDefaultLeague
  ? "TESTDRAWTESTDRAWTESTDRAW22"
  : codeFromName(LEAGUE_NAME, 26, "secret");

const TEAM_COUNT = 12;
async function remove() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id")
    .eq("name", LEAGUE_NAME);
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log(`No "${LEAGUE_NAME}" to remove.`);
    return;
  }
  // Every child table cascades from leagues (see supabase/schema.sql).
  const { error: deleteError } = await supabase
    .from("leagues")
    .delete()
    .eq("name", LEAGUE_NAME);
  if (deleteError) throw deleteError;
  console.log(`Removed ${data.length} "${LEAGUE_NAME}" league(s) and all their data.`);
}

async function create() {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from("leagues")
    .select("id")
    .eq("name", LEAGUE_NAME);
  if (existing && existing.length > 0) {
    console.log(
      `"${LEAGUE_NAME}" already exists. Run with --rm first if you want a fresh one.`
    );
    return;
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({ name: LEAGUE_NAME })
    .select("id")
    .single();
  if (leagueError) throw leagueError;

  const { error: secretsError } = await supabase.from("league_secrets").insert({
    league_id: league.id,
    league_code: LEAGUE_CODE,
    commissioner_secret: COMMISSIONER_SECRET,
  });
  if (secretsError) throw secretsError;

  const borrowed = await borrowFromRealLeague();
  const names =
    borrowed?.names ??
    Array.from(
      { length: TEAM_COUNT },
      (_, i) => `Test Team ${String(i + 1).padStart(2, "0")}`
    );
  const slots =
    borrowed?.slots && borrowed.slots.length > 0
      ? borrowed.slots
      : FALLBACK_SLOTS;
  // Rounds must equal the slot count, or the draft can't be completed.
  const rounds = slots.length;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .insert(names.map((name) => ({ league_id: league.id, name })))
    .select("id, name");
  if (teamsError) throw teamsError;

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .insert({
      league_id: league.id,
      type: "main",
      sequence: 1,
      status: "active",
      rounds,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (phaseError) throw phaseError;

  // Sorted by name so the starting order is the obvious one - that makes it
  // visually obvious when a draw has actually shuffled anything.
  const ordered = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const { error: phaseTeamsError } = await supabase.from("phase_teams").insert(
    ordered.map((team, index) => ({
      phase_id: phase.id,
      team_id: team.id,
      draft_position: index + 1,
    }))
  );
  if (phaseTeamsError) throw phaseTeamsError;

  const { error: slotsInsertError } = await supabase.from("roster_slots").insert(
    slots.map((slot, index) => ({
      phase_id: phase.id,
      slot_order: index + 1,
      slot_name: slot.slot_name,
      eligible_positions: slot.eligible_positions,
      is_bench: slot.is_bench,
    }))
  );
  if (slotsInsertError) throw slotsInsertError;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  console.log(`\nCreated "${LEAGUE_NAME}"`);
  console.log(
    `  teams:  ${teams.length}   rounds: ${rounds}${borrowed ? "   (mirroring the real league)" : ""}`
  );
  console.log(`\n  Open this to rehearse the order draw:`);
  console.log(`    ${base}/commish/order`);
  console.log(`  after signing in with:`);
  console.log(`    ${base}/commish/enter?secret=${COMMISSIONER_SECRET}`);
  // Carries --name through, or these would act on the default league.
  const suffix = isDefaultLeague ? "" : ` --name "${LEAGUE_NAME}"`;
  console.log(`\n  Start over with a fresh undrawn order:`);
  console.log(`    npm run test-league --${suffix} --reset`);
  console.log(`  Delete it when you're done:`);
  console.log(`    npm run test-league --${suffix} --rm\n`);
}

async function reset() {
  await remove();
  await create();
}

const main = process.argv.includes("--rm")
  ? remove
  : process.argv.includes("--reset")
    ? reset
    : create;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
