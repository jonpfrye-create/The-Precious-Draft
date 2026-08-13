import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { fetchAllPlayers } from "../src/lib/draft/player-pool";
import { availablePlayersForPhase } from "../src/lib/draft/pool-exclusion";

// Checks the cascade against real data: Leftovers must exclude everyone
// taken in Main, Microwave must exclude Main and Leftovers. The unit tests
// cover the logic; this covers the wiring - phase sequences, the queries,
// and the actual rows in the database.
//
// Reads only. Safe to run against any league, including the real one.
const LEAGUE_NAME = process.argv[2] ?? "ZZZ Draw Test";

async function main() {
  const supabase = createAdminSupabaseClient();
  const { data: leagues } = await supabase
    .from("leagues")
    .select("id")
    .eq("name", LEAGUE_NAME);
  if (!leagues || leagues.length === 0) {
    console.error(`No league named "${LEAGUE_NAME}".`);
    process.exit(1);
  }
  const leagueId = leagues[0].id;

  const { data: phases } = await supabase
    .from("phases")
    .select("id, type, sequence, status")
    .eq("league_id", leagueId)
    .order("sequence", { ascending: true });

  const all = await fetchAllPlayers(supabase);
  console.log(`\n"${LEAGUE_NAME}" — total pool: ${all.length}\n`);

  let failures = 0;

  for (const phase of phases ?? []) {
    const { data: priorPhases } = await supabase
      .from("phases")
      .select("id, sequence")
      .eq("league_id", leagueId)
      .lt("sequence", phase.sequence);

    const prior: { sequence: number; playerIds: string[] }[] = [];
    for (const p of priorPhases ?? []) {
      const { data: picks } = await supabase
        .from("picks")
        .select("player_id")
        .eq("phase_id", p.id);
      prior.push({
        sequence: p.sequence,
        playerIds: (picks ?? []).map((x) => x.player_id),
      });
    }

    const { data: own } = await supabase
      .from("picks")
      .select("player_id")
      .eq("phase_id", phase.id);
    const ownIds = (own ?? []).map((p) => p.player_id);

    const available = availablePlayersForPhase(
      all,
      prior,
      phase.sequence,
      ownIds
    );

    const priorIds = new Set(prior.flatMap((p) => p.playerIds));
    const leakedEarlier = available.filter((p) => priorIds.has(p.player_id));
    const ownSet = new Set(ownIds);
    const leakedOwn = available.filter((p) => ownSet.has(p.player_id));

    const kickers = available.filter((p) => p.position === "K");

    console.log(`${phase.type} (sequence ${phase.sequence}, ${phase.status})`);
    console.log(`  taken in earlier phases: ${priorIds.size}`);
    console.log(`  taken in this phase:     ${ownIds.length}`);
    console.log(`  still available:         ${available.length}`);
    console.log(
      `  kickers available:       ${kickers.length} (${kickers.filter((k) => k.nfl_team).length} rostered)`
    );

    if (leakedEarlier.length > 0) {
      failures++;
      console.log(
        `  FAIL: ${leakedEarlier.length} players from an earlier phase are still draftable`
      );
      for (const p of leakedEarlier.slice(0, 3)) {
        console.log(`      - ${p.full_name}`);
      }
    } else {
      console.log(`  ok: nothing from an earlier phase leaked through`);
    }

    if (leakedOwn.length > 0) {
      failures++;
      console.log(
        `  FAIL: ${leakedOwn.length} players already taken in this phase are still draftable`
      );
    }

    // Arithmetic has to add up exactly, or something is being double
    // counted or silently dropped.
    const expected = all.length - priorIds.size - ownIds.length;
    if (available.length !== expected) {
      failures++;
      console.log(
        `  FAIL: expected ${expected} available, got ${available.length}`
      );
    }
    console.log("");
  }

  if (failures > 0) {
    console.error(`${failures} problem(s) found.`);
    process.exit(1);
  }
  console.log("Cascade is correct at every phase.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
