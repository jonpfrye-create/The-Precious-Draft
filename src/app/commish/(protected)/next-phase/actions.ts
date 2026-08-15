"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import { nextPhaseType, type PhaseType } from "@/lib/draft/phase-templates";
import { getPhasesForLeague } from "@/lib/draft/queries";

export interface StartPhaseSlotInput {
  slotName: string;
  eligiblePositions: string[];
  isBench: boolean;
}

export interface StartPhaseInput {
  teamIds: string[];
  rosterSlots: StartPhaseSlotInput[];
}

export interface StartPhaseResult {
  ok: boolean;
  error?: string;
  phaseId?: string;
}

/**
 * Creates the next phase and moves the draft into it.
 *
 * Team lists are deliberately unconstrained: any team in the league may be
 * put in any phase, whether or not they played the previous one. Who's in
 * Leftovers is decided in the room by who's still around, and the software
 * shouldn't have an opinion about someone who wandered off for Leftovers
 * and came back for Microwave.
 */
export async function startNextPhase(
  input: StartPhaseInput
): Promise<StartPhaseResult> {
  const league = await requireCommissionerLeagueForAction();

  const teamIds = [...new Set(input.teamIds)];
  const rosterSlots = input.rosterSlots.filter((s) => s.slotName.trim());

  if (teamIds.length < 2) {
    return { ok: false, error: "Pick at least two teams for this phase." };
  }
  if (rosterSlots.length < 1) {
    return { ok: false, error: "This phase needs at least one roster slot." };
  }

  const phases = await getPhasesForLeague(league.id);
  if (phases.length === 0) {
    return { ok: false, error: "This league has no phases yet." };
  }

  const latest = phases[phases.length - 1];
  if (latest.status !== "completed") {
    return {
      ok: false,
      error: `The ${latest.type} draft isn't finished yet.`,
    };
  }

  const type = nextPhaseType(latest.type as PhaseType);
  if (!type) {
    return { ok: false, error: "Microwave is the last phase — nothing follows it." };
  }

  const supabase = createAdminSupabaseClient();

  // Every team must belong to this league. Without this, a crafted request
  // could pull a team out of someone else's league into this draft.
  const { data: validTeams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", league.id)
    .in("id", teamIds);
  if (teamsError) throw teamsError;
  if (!validTeams || validTeams.length !== teamIds.length) {
    return { ok: false, error: "Some of those teams aren't in this league." };
  }

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .insert({
      league_id: league.id,
      type,
      sequence: latest.sequence + 1,
      status: "active",
      rounds: rosterSlots.length,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (phaseError) throw phaseError;

  // Placeholder order, exactly like league setup: the real order comes from
  // the draw on /commish/order, with everyone watching.
  const { error: phaseTeamsError } = await supabase.from("phase_teams").insert(
    teamIds.map((team_id, index) => ({
      phase_id: phase.id,
      team_id,
      draft_position: index + 1,
    }))
  );
  if (phaseTeamsError) throw phaseTeamsError;

  const { error: slotsError } = await supabase.from("roster_slots").insert(
    rosterSlots.map((slot, index) => ({
      phase_id: phase.id,
      slot_order: index + 1,
      slot_name: slot.slotName.trim(),
      eligible_positions: slot.eligiblePositions,
      is_bench: slot.isBench,
    }))
  );
  if (slotsError) throw slotsError;

  return { ok: true, phaseId: phase.id as string };
}
