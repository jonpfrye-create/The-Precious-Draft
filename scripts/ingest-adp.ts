import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { fetchAllPlayers } from "../src/lib/draft/player-pool";
import { matchKey } from "../src/lib/draft/player-match";

// Pulls average draft position from Fantasy Football Calculator and writes
// it onto the player pool.
//
//   npm run refresh-adp
//   npm run refresh-adp -- --dry   report the match rate, write nothing
//
// FFC publishes a free JSON endpoint aggregated from real mock drafts, and
// reports the sample size and date range, so it's possible to tell how
// stale it is. Standard (non-PPR), 12 teams, to match this league.
//
// There is no shared id with Sleeper, so players are matched by name and
// position - see lib/draft/player-match.ts. Anything unmatched keeps a null
// ADP and simply shows no number, which is better than showing a wrong one.

const YEAR = new Date().getFullYear();
const ADP_URL = `https://fantasyfootballcalculator.com/api/v1/adp/standard?teams=12&year=${YEAR}`;

interface FfcPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
  adp_formatted: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const supabase = createAdminSupabaseClient();

  console.log(`Fetching ADP from Fantasy Football Calculator (${YEAR})...`);
  const res = await fetch(ADP_URL);
  if (!res.ok) {
    throw new Error(`ADP feed returned ${res.status}`);
  }
  const payload = (await res.json()) as {
    meta: { total_drafts: number; start_date: string; end_date: string };
    players: FfcPlayer[];
  };

  console.log(
    `  ${payload.players.length} players, from ${payload.meta.total_drafts} drafts ` +
      `between ${payload.meta.start_date} and ${payload.meta.end_date}\n`
  );

  // FFC calls kickers PK; everything else lines up with Sleeper.
  const normalizePosition = (position: string) =>
    position === "PK" ? "K" : position;

  const adpByKey = new Map<string, FfcPlayer>();
  for (const player of payload.players) {
    adpByKey.set(
      matchKey(player.name, normalizePosition(player.position), player.team),
      player
    );
  }

  const pool = await fetchAllPlayers(supabase);
  const updates: { player_id: string; adp: number; adp_formatted: string }[] = [];
  const unmatched: FfcPlayer[] = [];
  const matchedKeys = new Set<string>();

  for (const player of pool) {
    const key = matchKey(player.full_name, player.position, player.nfl_team);
    const found = adpByKey.get(key);
    if (!found) continue;
    matchedKeys.add(key);
    updates.push({
      player_id: player.player_id,
      adp: found.adp,
      adp_formatted: found.adp_formatted,
    });
  }

  for (const [key, player] of adpByKey) {
    if (!matchedKeys.has(key)) unmatched.push(player);
  }

  const rate = ((updates.length / payload.players.length) * 100).toFixed(1);
  console.log(`Matched ${updates.length} of ${payload.players.length} (${rate}%)`);

  if (unmatched.length > 0) {
    console.log(`\nUnmatched (${unmatched.length}) - highest ADP first:`);
    for (const p of unmatched.sort((a, b) => a.adp - b.adp).slice(0, 20)) {
      console.log(`  ${p.adp_formatted.padStart(6)}  ${p.name} (${p.position}, ${p.team})`);
    }
  }

  if (dryRun) {
    console.log("\nDry run - nothing written.\n");
    return;
  }

  // Updated one at a time rather than upserted: an upsert would need every
  // non-null column of the players table and would happily overwrite the
  // Sleeper data with nulls.
  let written = 0;
  for (const update of updates) {
    const { error } = await supabase
      .from("players")
      .update({ adp: update.adp, adp_formatted: update.adp_formatted })
      .eq("player_id", update.player_id);
    if (error) throw error;
    written++;
    if (written % 50 === 0) console.log(`  ...${written}`);
  }
  console.log(`\nWrote ADP for ${written} players.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
