/**
 * Puts a disposable league back to five o'clock: one Main phase, order
 * undrawn, no picks, no claims.
 *
 * For running the night through more than once - which is exactly what
 * Friday is for. Every previous reset was hand-written at the terminal,
 * and one of them left a phase with a draw count of 1 and no order,
 * which is a state the app cannot reach on its own: the page offered a
 * plain "Draw the draft order" while the action behind it demanded the
 * REDRAW phrase, and the button did nothing anyone could explain. A
 * reset that always leaves a coherent state is worth more than one typed
 * fresh each time.
 *
 *   npm run reset-league                     # the newest ZZZ league
 *   npm run reset-league -- --name "ZZZ Live Draft"
 *
 * Refuses point-blank to touch anything not named "ZZZ ". The real
 * league is one typo away from here and it holds the actual draft.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const TEST_PREFIX = "ZZZ ";

function nameArg(): string | null {
  const i = process.argv.indexOf("--name");
  return i !== -1 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const requested = nameArg();

  // The guard, before anything is read let alone written.
  if (requested !== null && !requested.startsWith(TEST_PREFIX)) {
    console.error(
      `Refusing: "${requested}" is not a disposable league.\n` +
        `Only leagues named "${TEST_PREFIX}..." can be reset - everything ` +
        `else is somebody's actual draft.`
    );
    process.exit(1);
  }

  const query = supabase.from("leagues").select("id, name");
  const { data: leagues, error } = requested
    ? await query.eq("name", requested).limit(1)
    : await query.like("name", `${TEST_PREFIX}%`).order("created_at", {
        ascending: false,
      });
  if (error) throw error;

  const league = leagues?.[0];
  if (!league) {
    console.error(
      requested
        ? `No league called "${requested}".`
        : `No ${TEST_PREFIX}league found. Run: npm run test-league`
    );
    process.exit(1);
  }

  // Belt and braces: the name is re-checked after the read, in case the
  // query ever changes shape.
  if (!league.name.startsWith(TEST_PREFIX)) {
    console.error(`Refusing to reset "${league.name}".`);
    process.exit(1);
  }

  console.log(`Resetting ${league.name}\n`);

  const { data: phases } = await supabase
    .from("phases")
    .select("id, type, sequence")
    .eq("league_id", league.id)
    .order("sequence");
  if (!phases?.length) {
    console.error("That league has no phases. Run: npm run test-league");
    process.exit(1);
  }

  const [first, ...later] = phases;

  // Leftovers and Microwave are created fresh by /commish/next-phase, so
  // the way back to the start is to remove them rather than rewind them.
  for (const phase of later) {
    const { error: dropError } = await supabase
      .from("phases")
      .delete()
      .eq("id", phase.id);
    if (dropError) throw dropError;
    console.log(`  removed the ${phase.type} phase`);
  }

  const { count: picks } = await supabase
    .from("picks")
    .select("*", { count: "exact", head: true })
    .eq("phase_id", first.id);
  await supabase.from("picks").delete().eq("phase_id", first.id);
  console.log(`  cleared ${picks ?? 0} picks from ${first.type}`);

  // Order and reveal go back together. Half a reset is what produced the
  // impossible state described at the top of this file.
  await supabase
    .from("phase_teams")
    .update({ revealed: false })
    .eq("phase_id", first.id);
  await supabase
    .from("phases")
    .update({
      status: "active",
      order_drawn_at: null,
      order_draw_count: 0,
      order_revealed_count: 0,
      completed_at: null,
    })
    .eq("id", first.id);
  console.log("  order undrawn, reveal wound back");

  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", league.id);
  const teamIds = (teams ?? []).map((t) => t.id);
  const { count: claims } = await supabase
    .from("team_claims")
    .select("*", { count: "exact", head: true })
    .in("team_id", teamIds);
  await supabase.from("team_claims").delete().in("team_id", teamIds);
  console.log(`  released ${claims ?? 0} team claims`);

  const { data: check } = await supabase
    .from("phases")
    .select("type, status, order_drawn_at, order_draw_count, order_revealed_count")
    .eq("league_id", league.id)
    .order("sequence");

  console.log("\nNow:");
  for (const p of check ?? []) {
    console.log(
      `  ${p.type}: status=${p.status} drawn=${
        p.order_drawn_at ? "yes" : "no"
      } drawCount=${p.order_draw_count} revealed=${p.order_revealed_count}`
    );
  }
  console.log(`  ${teamIds.length} teams, 0 claims, 0 picks`);
  console.log("\nEveryone rejoins at /join. The code is unchanged.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
