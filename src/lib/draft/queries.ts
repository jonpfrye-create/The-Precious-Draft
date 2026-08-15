import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { availablePlayersForPhase, type PhasePicks } from "./pool-exclusion";
import { fetchAllPlayers } from "./player-pool";

export interface League {
  id: string;
  name: string;
}

export interface Phase {
  id: string;
  league_id: string;
  type: "main" | "leftovers" | "microwave";
  sequence: number;
  status: "pending" | "active" | "paused" | "completed";
  rounds: number;
  // Null until the draft order has actually been drawn - a phase sitting on
  // the placeholder order typed in at setup must not look like a real draw.
  order_drawn_at: string | null;
  order_draw_count: number;
  // How many draft positions have been revealed, counted from the last
  // pick upwards. Equal to the team count once the reveal is finished.
  order_revealed_count: number;
}

export interface Team {
  id: string;
  name: string;
  draft_position: number;
}

export interface RosterSlot {
  id: string;
  slot_order: number;
  slot_name: string;
  eligible_positions: string[];
  is_bench: boolean;
}

export interface Player {
  player_id: string;
  full_name: string;
  position: string | null;
  nfl_team: string | null;
  search_rank: number | null;
  status: string | null;
  // Average draft position from Fantasy Football Calculator. Null for the
  // vast majority of the pool - the feed only covers players anyone
  // actually drafts.
  adp: number | null;
  adp_formatted: string | null;
}

export interface Pick {
  id: string;
  phase_id: string;
  team_id: string;
  player_id: string;
  pick_number: number;
  round: number;
  // Set when this player was put back into the pool for later phases. He
  // keeps his place on this roster; he just stops being excluded.
  released_at: string | null;
  // Where the commissioner pressed the sticker onto the board. Null for
  // auto-drafted picks, which fall back to a tilt derived from the pick id.
  placement_x: number | null;
  placement_y: number | null;
  placement_rotation: number | null;
}

// There is deliberately no "get the current league" helper. Commissioner
// routes resolve their league from the commissioner secret (see
// lib/auth/commissioner.ts); anything that guesses - "the oldest league",
// "the only league" - silently strands the commissioner on the wrong board
// the moment a second league exists.
export async function getLeagueById(leagueId: string): Promise<League | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function countLeagues(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("leagues")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// The phase currently being drafted: lowest sequence that isn't completed.
export async function getCurrentPhase(leagueId: string): Promise<Phase | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("phases")
    .select("id, league_id, type, sequence, status, rounds, order_drawn_at, order_draw_count, order_revealed_count")
    .eq("league_id", leagueId)
    .neq("status", "completed")
    .order("sequence", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPhaseById(phaseId: string): Promise<Phase | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("phases")
    .select("id, league_id, type, sequence, status, rounds, order_drawn_at, order_draw_count, order_revealed_count")
    .eq("id", phaseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Every phase in the league, oldest first. Used to work out which phase
// comes next and whether the current one has finished.
export async function getPhasesForLeague(leagueId: string): Promise<Phase[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("phases")
    .select(
      "id, league_id, type, sequence, status, rounds, order_drawn_at, order_draw_count, order_revealed_count"
    )
    .eq("league_id", leagueId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTeamsForPhase(phaseId: string): Promise<Team[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("phase_teams")
    .select("draft_position, teams (id, name)")
    .eq("phase_id", phaseId)
    .order("draft_position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const team = row.teams as unknown as { id: string; name: string };
    return {
      id: team.id,
      name: team.name,
      draft_position: row.draft_position,
    };
  });
}

// Every team in the league, regardless of which phases they're in. Team
// colours are seeded from this rather than from a phase's subset, so a
// team keeps the same colour across Main, Leftovers and Microwave - see
// lib/teams/branding.ts.
export async function getTeamsForLeague(
  leagueId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", leagueId);
  if (error) throw error;
  return data ?? [];
}

export async function getRosterSlots(phaseId: string): Promise<RosterSlot[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("roster_slots")
    .select("id, slot_order, slot_name, eligible_positions, is_bench")
    .eq("phase_id", phaseId)
    .order("slot_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPicks(phaseId: string): Promise<Pick[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("picks")
    .select(
      "id, phase_id, team_id, player_id, pick_number, round, released_at, placement_x, placement_y, placement_rotation"
    )
    .eq("phase_id", phaseId)
    .order("pick_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPlayersByIds(playerIds: string[]): Promise<Player[]> {
  if (playerIds.length === 0) return [];
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "player_id, full_name, position, nfl_team, search_rank, status, adp, adp_formatted"
    )
    .in("player_id", playerIds);
  if (error) throw error;
  return data ?? [];
}

export async function getAllPlayers(): Promise<Player[]> {
  // Paged, because Supabase truncates any response at 1000 rows - see
  // lib/draft/player-pool.ts for why that silently broke the kicker round.
  return fetchAllPlayers(createAdminSupabaseClient());
}

// All picks made in any phase of this league with a lower sequence than
// the target phase, grouped for the pool-exclusion lib.
export async function getPriorPhasePicks(
  leagueId: string,
  targetSequence: number
): Promise<PhasePicks[]> {
  const supabase = createAdminSupabaseClient();
  const { data: priorPhases, error: phasesError } = await supabase
    .from("phases")
    .select("id, sequence")
    .eq("league_id", leagueId)
    .lt("sequence", targetSequence);
  if (phasesError) throw phasesError;
  if (!priorPhases || priorPhases.length === 0) return [];

  const { data: picks, error: picksError } = await supabase
    .from("picks")
    .select("phase_id, player_id")
    .in(
      "phase_id",
      priorPhases.map((p) => p.id)
    )
    // A released player still sits on his original team's roster, but no
    // longer blocks anyone in a later phase - see
    // supabase/006-releases-and-grades.sql.
    .is("released_at", null);
  if (picksError) throw picksError;

  const sequenceByPhaseId = new Map(priorPhases.map((p) => [p.id, p.sequence]));
  const playerIdsBySequence = new Map<number, string[]>();
  for (const pick of picks ?? []) {
    const sequence = sequenceByPhaseId.get(pick.phase_id)!;
    const list = playerIdsBySequence.get(sequence) ?? [];
    list.push(pick.player_id);
    playerIdsBySequence.set(sequence, list);
  }
  return Array.from(playerIdsBySequence.entries()).map(([sequence, playerIds]) => ({
    sequence,
    playerIds,
  }));
}

// Only what the sticker sheet actually renders. The full Player row also
// carries search_rank, status and the numeric adp, none of which the board
// uses - and the sheet ships every player in the pool to the browser on
// every refresh, which happens after every single pick. Dropping three
// unused fields costs nothing and is repaid 168 times on draft day.
export interface SheetPlayer {
  player_id: string;
  full_name: string;
  position: string | null;
  nfl_team: string | null;
  adp_formatted: string | null;
  /** Already drafted - in this phase or an earlier one. */
  taken: boolean;
}

/**
 * The whole pool for the sticker sheet, in draft order, with drafted
 * players marked rather than removed.
 *
 * The sheet keeps a gap where every peeled sticker used to be, which is
 * both how the physical sheets worked and where Leftovers got its name -
 * by the time that phase starts, the sheet is mostly holes.
 */
export async function getSheetPlayersForPhase(
  phase: Phase
): Promise<SheetPlayer[]> {
  const [allPlayers, priorPhasePicks, thisPhasePicks] = await Promise.all([
    getAllPlayers(),
    getPriorPhasePicks(phase.league_id, phase.sequence),
    getPicks(phase.id),
  ]);

  const taken = new Set<string>(thisPhasePicks.map((p) => p.player_id));
  for (const prior of priorPhasePicks) {
    if (prior.sequence < phase.sequence) {
      for (const id of prior.playerIds) taken.add(id);
    }
  }

  return allPlayers.map((player) => ({
    player_id: player.player_id,
    full_name: player.full_name,
    position: player.position,
    nfl_team: player.nfl_team,
    adp_formatted: player.adp_formatted,
    taken: taken.has(player.player_id),
  }));
}

/**
 * How many undrafted players are left at each position, for a phase that
 * hasn't started yet. Feeds the scarcity check on the Start Leftovers
 * screen - see lib/draft/scarcity.ts.
 */
export async function getAvailableCountsByPosition(
  leagueId: string,
  sequence: number
): Promise<Record<string, number>> {
  const [allPlayers, priorPhasePicks] = await Promise.all([
    getAllPlayers(),
    getPriorPhasePicks(leagueId, sequence),
  ]);
  const available = availablePlayersForPhase(allPlayers, priorPhasePicks, sequence);

  const counts: Record<string, number> = {};
  for (const player of available) {
    if (!player.position) continue;
    counts[player.position] = (counts[player.position] ?? 0) + 1;
  }
  return counts;
}

export async function getAvailablePlayersForPhase(phase: Phase): Promise<Player[]> {
  const [allPlayers, priorPhasePicks, thisPhasePicks] = await Promise.all([
    getAllPlayers(),
    getPriorPhasePicks(phase.league_id, phase.sequence),
    getPicks(phase.id),
  ]);
  return availablePlayersForPhase(
    allPlayers,
    priorPhasePicks,
    phase.sequence,
    thisPhasePicks.map((p) => p.player_id)
  );
}
