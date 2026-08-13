import type { SupabaseClient } from "@supabase/supabase-js";
import { sortByDraftability, type RankablePlayer } from "./player-ranking";

export interface PoolPlayer extends RankablePlayer {
  player_id: string;
}

// Supabase caps every REST response at 1000 rows, server-side. Neither
// .limit() nor a large .range() lifts it - the only way to read a bigger
// table is to page through it.
//
// This bit hard: the pool is 4254 players, so a plain select was silently
// returning under a quarter of it. Worse, the truncation happened after
// ordering by search_rank, so the players that vanished were precisely the
// ones Sleeper doesn't rank - every active kicker among them. The Leftovers
// kicker round would have had no kickers in it.
//
// Deliberately not in queries.ts, which is "server-only" and therefore
// unreachable from scripts/check-pool.ts - the one thing that can actually
// prove this still works against the real table.
export const SUPABASE_MAX_ROWS = 1000;

const PLAYER_COLUMNS =
  "player_id, full_name, position, nfl_team, search_rank, status";

export async function fetchAllPlayers(
  supabase: SupabaseClient
): Promise<PoolPlayer[]> {
  const all: PoolPlayer[] = [];

  for (let from = 0; ; from += SUPABASE_MAX_ROWS) {
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_COLUMNS)
      // Ordering by primary key only makes the paging deterministic - two
      // pages must never overlap or skip. The ordering that matters is
      // applied once at the end.
      .order("player_id", { ascending: true })
      .range(from, from + SUPABASE_MAX_ROWS - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as PoolPlayer[]));
    if (data.length < SUPABASE_MAX_ROWS) break;
  }

  return sortByDraftability(all);
}
