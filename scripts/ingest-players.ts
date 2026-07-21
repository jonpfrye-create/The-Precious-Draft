import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";

// Sleeper returns every player it has ever heard of (retired,
// practice-squad-only, etc). This league only ever drafts these.
const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  search_rank?: number;
  status?: string;
}

async function main() {
  console.log("Fetching player pool from Sleeper...");
  const res = await fetch(SLEEPER_PLAYERS_URL);
  if (!res.ok) {
    throw new Error(`Sleeper API request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Record<string, SleeperPlayer>;

  const rows = Object.values(data)
    .filter((p): p is SleeperPlayer & { position: string } =>
      Boolean(p.position && FANTASY_POSITIONS.has(p.position))
    )
    .map((p) => ({
      player_id: p.player_id,
      full_name: p.full_name ?? [p.first_name, p.last_name].filter(Boolean).join(" "),
      position: p.position,
      nfl_team: p.team ?? null,
      search_rank: p.search_rank ?? null,
      status: p.status ?? null,
      updated_at: new Date().toISOString(),
    }));

  console.log(`Upserting ${rows.length} players...`);

  const supabase = createAdminSupabaseClient();
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("players")
      .upsert(batch, { onConflict: "player_id" });
    if (error) throw error;
    console.log(`  ...${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
