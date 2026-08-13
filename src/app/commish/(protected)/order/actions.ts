"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import {
  assignDraftPositions,
  evaluateDrawRequest,
  REDRAW_CONFIRMATION,
  shuffle,
} from "@/lib/draft/order-draw";
import { getPhaseById, getPicks, getTeamsForPhase } from "@/lib/draft/queries";

export interface DrawResult {
  ok: boolean;
  error?: string;
  order?: { teamId: string; teamName: string; draftPosition: number }[];
  drawCount?: number;
}

/**
 * Draws (or redraws) the draft order for a phase.
 *
 * The shuffle happens here, on the server, and never on the client - a
 * draw the commissioner's browser could compute is a draw the
 * commissioner's browser could retry silently until it liked the answer.
 */
export async function drawDraftOrder(
  phaseId: string,
  confirmation?: string
): Promise<DrawResult> {
  // Commissioner-only, checked here because a server action is its own HTTP
  // endpoint and never runs the (protected) layout.
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return { ok: false, error: "That phase belongs to a different league" };
  }

  const [teams, picks] = await Promise.all([
    getTeamsForPhase(phaseId),
    getPicks(phaseId),
  ]);
  if (teams.length === 0) {
    return { ok: false, error: "This phase has no teams yet" };
  }

  const decision = evaluateDrawRequest({
    picksMade: picks.length,
    drawCount: phase.order_draw_count,
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.reason };
  }
  if (
    decision.requiresConfirmation &&
    confirmation?.trim().toUpperCase() !== REDRAW_CONFIRMATION
  ) {
    return {
      ok: false,
      error: `Type ${REDRAW_CONFIRMATION} to confirm a redraw.`,
    };
  }

  const shuffled = shuffle(teams.map((t) => t.id));
  const positions = assignDraftPositions(shuffled);
  const supabase = createAdminSupabaseClient();

  // phase_teams has a UNIQUE (phase_id, draft_position) constraint, so
  // updating rows one at a time would collide with positions not yet
  // moved. Deleting the whole set and reinserting sidesteps the ordering
  // problem entirely - and it's safe here precisely because this can only
  // run before any pick exists.
  const { error: deleteError } = await supabase
    .from("phase_teams")
    .delete()
    .eq("phase_id", phaseId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("phase_teams").insert(
    positions.map((p) => ({
      phase_id: phaseId,
      team_id: p.teamId,
      draft_position: p.draftPosition,
    }))
  );
  if (insertError) throw insertError;

  const drawCount = phase.order_draw_count + 1;
  const { error: phaseError } = await supabase
    .from("phases")
    .update({
      order_drawn_at: new Date().toISOString(),
      order_draw_count: drawCount,
    })
    .eq("id", phaseId);
  if (phaseError) throw phaseError;

  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  return {
    ok: true,
    drawCount,
    order: positions.map((p) => ({
      teamId: p.teamId,
      teamName: nameById.get(p.teamId) ?? "Unknown team",
      draftPosition: p.draftPosition,
    })),
  };
}
