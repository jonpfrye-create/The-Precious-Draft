"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import { generateSnakeOrder } from "@/lib/draft/snake-order";
import { availablePlayersForPhase } from "@/lib/draft/pool-exclusion";
import {
  getPhaseById,
  getPicks,
  getPriorPhasePicks,
  getTeamsForPhase,
} from "@/lib/draft/queries";

// Every action in this file re-checks commissioner access itself. The
// (protected) layout only guards page *rendering* - server actions are
// separate HTTP endpoints that never run it, so relying on the layout
// alone would leave picks and undo open to anyone who knew the endpoint.
//
// The phase is then checked to belong to the commissioner's own league, so
// a valid secret for one league can't be used to edit another's draft.

export async function makePick(phaseId: string, playerId: string) {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) throw new Error("Phase not found");
  if (phase.league_id !== league.id) {
    throw new Error("That phase belongs to a different league");
  }

  const [teams, picks, priorPhasePicks] = await Promise.all([
    getTeamsForPhase(phaseId),
    getPicks(phaseId),
    getPriorPhasePicks(phase.league_id, phase.sequence),
  ]);

  const snakeOrder = generateSnakeOrder(
    teams.map((t) => t.id),
    phase.rounds
  );

  if (picks.length >= snakeOrder.length) {
    throw new Error("This phase is already complete");
  }

  const onTheClock = snakeOrder[picks.length];

  // Recompute the available pool server-side rather than trusting the
  // client's idea of what's available - this is the one place a stale
  // client (or a future non-commissioner drafter) could try to draft an
  // already-excluded player.
  const available = availablePlayersForPhase(
    [{ player_id: playerId }],
    priorPhasePicks,
    phase.sequence,
    picks.map((p) => p.player_id)
  );
  if (available.length === 0) {
    throw new Error("That player is not available in this phase");
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("picks").insert({
    phase_id: phaseId,
    team_id: onTheClock.teamId,
    player_id: playerId,
    pick_number: onTheClock.overallPick,
    round: onTheClock.round,
  });
  if (error) throw error;

  const isPhaseComplete = picks.length + 1 >= snakeOrder.length;
  if (isPhaseComplete) {
    const { error: completeError } = await supabase
      .from("phases")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", phaseId);
    if (completeError) throw completeError;
  }
}

export async function undoLastPick(phaseId: string) {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) throw new Error("Phase not found");
  if (phase.league_id !== league.id) {
    throw new Error("That phase belongs to a different league");
  }

  const supabase = createAdminSupabaseClient();

  const { data: lastPick, error: lastPickError } = await supabase
    .from("picks")
    .select("id")
    .eq("phase_id", phaseId)
    .order("pick_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastPickError) throw lastPickError;
  if (!lastPick) throw new Error("No picks to undo");

  const { error: deleteError } = await supabase
    .from("picks")
    .delete()
    .eq("id", lastPick.id);
  if (deleteError) throw deleteError;

  // Undoing the final pick of a completed phase reopens it.
  const { error: reopenError } = await supabase
    .from("phases")
    .update({ status: "active", completed_at: null })
    .eq("id", phaseId)
    .eq("status", "completed");
  if (reopenError) throw reopenError;
}
