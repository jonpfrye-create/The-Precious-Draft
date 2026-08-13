"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import { chooseAutoPick, isDemoLeague } from "@/lib/draft/auto-pick";
import { availablePlayersForPhase } from "@/lib/draft/pool-exclusion";
import { generateSnakeOrder } from "@/lib/draft/snake-order";
import {
  getAllPlayers,
  getCurrentPhase,
  getPhasesForLeague,
  getPicks,
  getPriorPhasePicks,
  getRosterSlots,
  getTeamsForPhase,
  type League,
} from "@/lib/draft/queries";

export interface DemoResult {
  ok: boolean;
  error?: string;
  picksMade?: number;
  phaseComplete?: boolean;
}

/**
 * These actions write and delete picks in bulk, so the guard is not
 * "don't show the button" - the UI hides it, and this refuses regardless.
 * A demo tool that could be pointed at the real draft by editing a URL is
 * not a safe demo tool.
 */
async function requireDemoLeague(): Promise<League | { error: string }> {
  const league = await requireCommissionerLeagueForAction();
  if (!isDemoLeague(league.name)) {
    return {
      error:
        "Demo controls only work on the throwaway league, never on a real draft.",
    };
  }
  return league;
}

export async function simulatePicks(count: number): Promise<DemoResult> {
  const league = await requireDemoLeague();
  if ("error" in league) return { ok: false, error: league.error };

  const phase = await getCurrentPhase(league.id);
  if (!phase) {
    return { ok: false, error: "No phase in progress." };
  }

  const [teams, slots, allPlayers] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getAllPlayers(),
  ]);
  const slotSpecs = slots.map((s) => ({
    slotName: s.slot_name,
    eligiblePositions: s.eligible_positions,
  }));
  const positionById = new Map(
    allPlayers.map((p) => [p.player_id, p.position])
  );

  const snakeOrder = generateSnakeOrder(
    teams.map((t) => t.id),
    phase.rounds
  );

  const picks = await getPicks(phase.id);
  const priorPhasePicks = await getPriorPhasePicks(
    phase.league_id,
    phase.sequence
  );

  const taken = picks.map((p) => p.player_id);
  const draftedByTeam = new Map<string, (string | null)[]>();
  for (const pick of picks) {
    const list = draftedByTeam.get(pick.team_id) ?? [];
    list.push(positionById.get(pick.player_id) ?? null);
    draftedByTeam.set(pick.team_id, list);
  }

  const supabase = createAdminSupabaseClient();
  const start = picks.length;
  const end = Math.min(start + count, snakeOrder.length);
  const rows: Record<string, unknown>[] = [];

  for (let i = start; i < end; i++) {
    const onTheClock = snakeOrder[i];
    const drafted = draftedByTeam.get(onTheClock.teamId) ?? [];
    const available = availablePlayersForPhase(
      allPlayers,
      priorPhasePicks,
      phase.sequence,
      taken
    );
    const choice = chooseAutoPick(available, drafted, slotSpecs);
    if (!choice) break;

    rows.push({
      phase_id: phase.id,
      team_id: onTheClock.teamId,
      player_id: choice.player_id,
      pick_number: onTheClock.overallPick,
      round: onTheClock.round,
    });
    taken.push(choice.player_id);
    draftedByTeam.set(onTheClock.teamId, [...drafted, choice.position]);
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("picks").insert(rows);
    if (error) throw error;
  }

  const complete = start + rows.length >= snakeOrder.length;
  if (complete) {
    const { error } = await supabase
      .from("phases")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", phase.id);
    if (error) throw error;
  }

  return { ok: true, picksMade: rows.length, phaseComplete: complete };
}

/**
 * Puts the demo league back to the start: every pick gone, Leftovers and
 * Microwave removed, Main active with its order undrawn again.
 *
 * Deliberately keeps the league itself, so the commissioner link stays
 * valid and whoever's watching doesn't get signed out mid-demo.
 */
export async function resetDemo(): Promise<DemoResult> {
  const league = await requireDemoLeague();
  if ("error" in league) return { ok: false, error: league.error };

  const supabase = createAdminSupabaseClient();
  const phases = await getPhasesForLeague(league.id);

  for (const phase of phases) {
    const { error: picksError } = await supabase
      .from("picks")
      .delete()
      .eq("phase_id", phase.id);
    if (picksError) throw picksError;
  }

  // Everything after Main goes entirely - those phases are created fresh
  // each time the draft moves on.
  for (const phase of phases.filter((p) => p.sequence > 1)) {
    const { error } = await supabase.from("phases").delete().eq("id", phase.id);
    if (error) throw error;
  }

  const main = phases.find((p) => p.sequence === 1);
  if (main) {
    const { error } = await supabase
      .from("phases")
      .update({
        status: "active",
        completed_at: null,
        order_drawn_at: null,
        order_draw_count: 0,
        order_revealed_count: 0,
      })
      .eq("id", main.id);
    if (error) throw error;

    // Un-reveal the order so the draw can be demonstrated again.
    const { error: teamsError } = await supabase
      .from("phase_teams")
      .update({ revealed: true })
      .eq("phase_id", main.id);
    if (teamsError) throw teamsError;
  }

  return { ok: true, picksMade: 0 };
}
