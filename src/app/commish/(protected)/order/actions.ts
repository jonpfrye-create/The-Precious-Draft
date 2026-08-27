"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import {
  assignDraftPositions,
  evaluateDrawRequest,
  nextRevealStep,
  REDRAW_CONFIRMATION,
  shuffle,
} from "@/lib/draft/order-draw";
import { getPhaseById, getPicks, getTeamsForPhase } from "@/lib/draft/queries";

export interface DrawResult {
  ok: boolean;
  error?: string;
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
    // The same field the button reads, so the two can never disagree
    // about whether this is a first draw or a redraw.
    hasBeenDrawn: phase.order_drawn_at !== null,
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

  // Rows go in unrevealed. The order exists in the database from this
  // moment, but nothing outside the commissioner's session can read it
  // until each position is revealed (RLS on phase_teams; see
  // supabase/003-order-reveal.sql).

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
      revealed: false,
    }))
  );
  if (insertError) throw insertError;

  const drawCount = phase.order_draw_count + 1;
  const { error: phaseError } = await supabase
    .from("phases")
    .update({
      order_drawn_at: new Date().toISOString(),
      order_draw_count: drawCount,
      order_revealed_count: 0,
    })
    .eq("id", phaseId);
  if (phaseError) throw phaseError;

  return { ok: true, drawCount };
}

export interface RevealResult {
  ok: boolean;
  error?: string;
  // The team uncovered by this click. Always exactly one.
  revealed?: { teamName: string; draftPosition: number }[];
  revealedCount?: number;
  // This click revealed the first overall pick.
  isFinale?: boolean;
  // Only pick 1 is left after this click, so the UI holds for a moment.
  setsUpFinale?: boolean;
  isComplete?: boolean;
}

/**
 * Uncovers the next draft position - exactly one per call, down to pick 1.
 *
 * Advancing one click at a time is the point: the commissioner controls
 * the pace in the room, and because the count lives on the phase row
 * rather than in their browser, a refresh mid-reveal picks up exactly
 * where it left off.
 */
export async function revealNextPosition(
  phaseId: string
): Promise<RevealResult> {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return { ok: false, error: "That phase belongs to a different league" };
  }
  if (phase.order_drawn_at === null) {
    return { ok: false, error: "Draw the order before revealing it" };
  }

  const teams = await getTeamsForPhase(phaseId);
  const step = nextRevealStep(teams.length, phase.order_revealed_count);
  if (!step) {
    return { ok: false, error: "The whole order has already been revealed" };
  }

  const supabase = createAdminSupabaseClient();
  const { error: revealError } = await supabase
    .from("phase_teams")
    .update({ revealed: true })
    .eq("phase_id", phaseId)
    .in("draft_position", step.positions);
  if (revealError) throw revealError;

  const { error: countError } = await supabase
    .from("phases")
    .update({ order_revealed_count: step.revealedAfter })
    .eq("id", phaseId);
  if (countError) throw countError;

  const nameByPosition = new Map(
    teams.map((t) => [t.draft_position, t.name])
  );
  return {
    ok: true,
    revealedCount: step.revealedAfter,
    isFinale: step.isFinale,
    setsUpFinale: step.setsUpFinale,
    isComplete: step.revealedAfter >= teams.length,
    revealed: step.positions.map((draftPosition) => ({
      draftPosition,
      teamName: nameByPosition.get(draftPosition) ?? "Unknown team",
    })),
  };
}
