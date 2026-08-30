import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";

/**
 * Stops the Main draft insisting every team finishes with a defense.
 *
 * Decided in the last round of the 2026 draft: nobody wanted to spend
 * their final pick on a defense they didn't want.
 *
 * There is no rule anywhere saying "you must draft a defense" - it falls
 * out of the roster shape, which is the whole point of roster-fit.ts.
 * Main's DEF slot accepts `["DEF"]` and nothing else, so by the last
 * round the only unfilled slot a team has is one that only a defense can
 * go in, and `canFillRoster` refuses everything else. Widening what that
 * slot accepts removes the requirement without touching a line of logic.
 *
 * Deliberately a data change. It is draft day, a deploy would break every
 * page already open in the room, and roster slots are read fresh from the
 * database on every request - so this lands on the next refresh, which
 * happens on the next pick anyway.
 *
 * K is left off the list on purpose. It keeps the position tabs exactly
 * as they are - adding K here would make a kicker tab appear on the
 * television mid-draft - and it costs nothing: the six bench slots still
 * accept kickers, and the roster matching is free to shuffle a receiver
 * into this slot to make room for one.
 *
 *   npx tsx scripts/open-def-slot.ts            show what it would do
 *   npx tsx scripts/open-def-slot.ts --apply    do it
 *   npx tsx scripts/open-def-slot.ts --revert   put the requirement back
 */

const LEAGUE = "The Precious";
const OPEN = ["QB", "RB", "WR", "TE", "DEF"];
const STRICT = ["DEF"];

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");

async function main() {
  const supabase = createAdminSupabaseClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("name", LEAGUE)
    .single();
  if (leagueError || !league) {
    console.error(`No league called "${LEAGUE}".`);
    process.exit(1);
  }

  // Main only. Leftovers starts its own defense and that draft has not
  // been set up yet, so leave it alone - this is a decision about the
  // round being played right now.
  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .select("id, type")
    .eq("league_id", league.id)
    .eq("sequence", 1)
    .single();
  if (phaseError || !phase) {
    console.error("No Main phase found.");
    process.exit(1);
  }

  const { data: slot, error: slotError } = await supabase
    .from("roster_slots")
    .select("id, slot_name, eligible_positions, is_bench")
    .eq("phase_id", phase.id)
    .eq("slot_name", "DEF")
    .single();
  if (slotError || !slot) {
    console.error("Main has no slot called DEF.");
    process.exit(1);
  }

  const target = REVERT ? STRICT : OPEN;
  console.log(`\n${LEAGUE} — Main, slot "${slot.slot_name}"`);
  console.log(`  now:  [${slot.eligible_positions.join(", ")}]`);
  console.log(`  to:   [${target.join(", ")}]`);
  console.log(
    REVERT
      ? "\n  Every team would have to finish with a defense again."
      : "\n  No team has to finish with a defense. Anyone who already took" +
          "\n  one keeps it in this slot."
  );

  if (!APPLY && !REVERT) {
    console.log("\nNothing changed. Re-run with --apply to do it.\n");
    return;
  }

  const { error } = await supabase
    .from("roster_slots")
    .update({ eligible_positions: target })
    .eq("id", slot.id);
  if (error) throw error;

  const { data: after } = await supabase
    .from("roster_slots")
    .select("eligible_positions")
    .eq("id", slot.id)
    .single();
  console.log(`\nDone. Slot now accepts: [${after?.eligible_positions.join(", ")}]`);
  console.log(
    "\nReload the commissioner board once. Every phone picks it up on its" +
      "\nnext refresh, which happens on the next pick.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
