import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { fetchAllPlayers } from "../src/lib/draft/player-pool";

// Diagnostic kept around because the failure it catches is silent: Supabase
// caps responses at 1000 rows, so "select everything" quietly returns a
// fraction of a big table. Run it after any change to how the pool loads.
async function main() {
  const supabase = createAdminSupabaseClient();

  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });
  const players = await fetchAllPlayers(supabase);

  console.log(`rows in table:  ${count}`);
  console.log(`players loaded: ${players.length}`);
  console.log(
    players.length === count ? "  -> complete\n" : "  -> TRUNCATED\n"
  );

  const kickers = players.filter((p) => p.position === "K");
  const defenses = players.filter((p) => p.position === "DEF");
  console.log(
    `kickers: ${kickers.length} (${kickers.filter((k) => k.nfl_team).length} rostered)`
  );
  console.log(
    `defenses: ${defenses.length} (${defenses.filter((d) => d.nfl_team).length} rostered)`
  );

  console.log("\ntop 5 overall:");
  for (const p of players.slice(0, 5)) {
    console.log(`  ${p.full_name} (${p.position}, ${p.nfl_team ?? "no team"})`);
  }

  console.log("\ntop 5 kickers:");
  for (const p of kickers.slice(0, 5)) {
    console.log(
      `  ${p.full_name} (${p.nfl_team ?? "NO TEAM"}, ${p.status}, rank ${p.search_rank})`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
