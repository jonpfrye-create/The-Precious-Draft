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

const LEAGUE_NAME = "ZZZ Draw Test";

// Fixed so re-running is predictable. Valid code shapes (Crockford base32,
// no I/L/O/U) so they behave exactly like generated ones.
const LEAGUE_CODE = "TESTAA";
const COMMISSIONER_SECRET = "TESTDRAWTESTDRAWTESTDRAW22";

const TEAM_COUNT = 12;
const ROUNDS = 3;

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

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .insert(
      Array.from({ length: TEAM_COUNT }, (_, i) => ({
        league_id: league.id,
        name: `Test Team ${String(i + 1).padStart(2, "0")}`,
      }))
    )
    .select("id, name");
  if (teamsError) throw teamsError;

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .insert({
      league_id: league.id,
      type: "main",
      sequence: 1,
      status: "active",
      rounds: ROUNDS,
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

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  console.log(`\nCreated "${LEAGUE_NAME}"`);
  console.log(`  league id: ${league.id}`);
  console.log(`  phase id:  ${phase.id}`);
  console.log(`  teams:     ${teams.length}`);
  console.log(`  commissioner link:\n    ${base}/commish/enter?secret=${COMMISSIONER_SECRET}`);
  console.log(`\n  Remove it with: npm run test-league -- --rm\n`);
}

const main = process.argv.includes("--rm") ? remove : create;
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
