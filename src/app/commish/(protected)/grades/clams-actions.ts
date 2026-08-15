"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import {
  getPhaseById,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { scoutTeam, type ScoutedPickInput } from "@/lib/draft/scouting";
import { gradeLikeClams, ClamsNotConfiguredError } from "@/lib/ai/clams";

/**
 * Sealing and revealing Clams AI's grade.
 *
 * The order matters more than anything technical here. If the grade is
 * generated after the commissioner announces his own, the room sees a
 * machine paraphrasing him. If it is visible before he speaks, he is
 * reacting to a robot. So it is written early, kept hidden, and flipped
 * over afterwards - and `sealed_at` is the evidence that it really did
 * come first.
 *
 * Every action re-checks the commissioner and then re-checks that the
 * phase belongs to that commissioner's league. The (protected) layout
 * gates page rendering only; server actions are separate HTTP endpoints
 * that never run it.
 */

export interface SealResult {
  ok: boolean;
  error?: string;
  needsApiKey?: boolean;
  sealedAt?: string;
}

export async function sealClamsGrade(
  phaseId: string,
  teamId: string
): Promise<SealResult> {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return { ok: false, error: "That phase belongs to a different league" };
  }

  const supabase = createAdminSupabaseClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .eq("league_id", league.id)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team) return { ok: false, error: "That team isn't in this league." };

  // Re-sealing a team that has already been revealed would let the
  // commissioner roll for a grade he likes better after seeing the first
  // one, which is exactly the thing the seal exists to rule out.
  const { data: existing } = await supabase
    .from("team_grades")
    .select("revealed_at")
    .eq("phase_id", phaseId)
    .eq("team_id", teamId)
    .eq("source", "ai")
    .maybeSingle();
  if (existing?.revealed_at) {
    return {
      ok: false,
      error: "That grade has already been revealed - it can't be resealed.",
    };
  }

  const [slots, picks, phaseTeams] = await Promise.all([
    getRosterSlots(phaseId),
    getPicks(phaseId),
    getTeamsForPhase(phaseId),
  ]);

  const teamPicks = picks.filter((p) => p.team_id === teamId);
  if (teamPicks.length === 0) {
    return { ok: false, error: "That team hasn't drafted anyone yet." };
  }

  const players = await getPlayersByIds(teamPicks.map((p) => p.player_id));
  const playerById = new Map(players.map((p) => [p.player_id, p]));

  const scoutedPicks: ScoutedPickInput[] = teamPicks.map((pick) => {
    const player = playerById.get(pick.player_id);
    return {
      pickNumber: pick.pick_number,
      round: pick.round,
      player: {
        fullName: player?.full_name ?? "Unknown",
        position: player?.position ?? null,
        nflTeam: player?.nfl_team ?? null,
        adp: player?.adp ?? null,
      },
    };
  });

  const draftPosition =
    phaseTeams.find((t) => t.id === teamId)?.draft_position ?? null;

  const report = scoutTeam(
    team.name,
    draftPosition,
    scoutedPicks,
    slots.map((s) => ({
      slotName: s.slot_name,
      eligiblePositions: s.eligible_positions,
      isBench: s.is_bench,
    }))
  );

  let generated;
  try {
    // The league name and phase type are what build the key that keeps
    // this team's own grade out of the examples, so they must match what
    // export-voice wrote - hence the league's real name, not a label.
    generated = await gradeLikeClams(league.name, phase.type, report);
  } catch (error) {
    if (error instanceof ClamsNotConfiguredError) {
      return { ok: false, error: error.message, needsApiKey: true };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Clams AI failed.",
    };
  }

  const sealedAt = new Date().toISOString();
  const { error: saveError } = await supabase.from("team_grades").upsert(
    {
      phase_id: phaseId,
      team_id: teamId,
      source: "ai",
      grade: generated.grade,
      comment: generated.comment,
      model: generated.model,
      sealed_at: sealedAt,
      revealed_at: null,
      updated_at: sealedAt,
    },
    { onConflict: "phase_id,team_id,source" }
  );
  if (saveError) throw saveError;

  // Deliberately returns no grade or comment. A sealed grade that arrives
  // in the browser is not sealed - it is one devtools panel away from
  // being spoiled, on the commissioner's own laptop, in a room full of
  // people who would find that funny.
  return { ok: true, sealedAt };
}

export interface RevealResult {
  ok: boolean;
  error?: string;
}

export async function revealClamsGrade(
  phaseId: string,
  teamId: string
): Promise<RevealResult> {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return { ok: false, error: "That phase belongs to a different league" };
  }

  const supabase = createAdminSupabaseClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("league_id", league.id)
    .maybeSingle();
  if (!team) return { ok: false, error: "That team isn't in this league." };

  const { data: sealed } = await supabase
    .from("team_grades")
    .select("id, revealed_at")
    .eq("phase_id", phaseId)
    .eq("team_id", teamId)
    .eq("source", "ai")
    .maybeSingle();
  if (!sealed) {
    return { ok: false, error: "There's no sealed grade for that team yet." };
  }
  if (sealed.revealed_at) return { ok: true }; // Already face up.

  const { error } = await supabase
    .from("team_grades")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", sealed.id);
  if (error) throw error;

  return { ok: true };
}

export interface SealAllResult {
  ok: boolean;
  sealed: number;
  skipped: number;
  error?: string;
  needsApiKey?: boolean;
}

/**
 * Seals every team that has drafted and isn't already sealed.
 *
 * Sequential rather than parallel: twelve at once invites a rate limit,
 * and the failure would land halfway through with no clear record of
 * which teams made it.
 */
export async function sealAllClamsGrades(
  phaseId: string
): Promise<SealAllResult> {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, sealed: 0, skipped: 0, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return {
      ok: false,
      sealed: 0,
      skipped: 0,
      error: "That phase belongs to a different league",
    };
  }

  const supabase = createAdminSupabaseClient();
  const teams = await getTeamsForPhase(phaseId);

  const { data: existing } = await supabase
    .from("team_grades")
    .select("team_id")
    .eq("phase_id", phaseId)
    .eq("source", "ai");
  const alreadySealed = new Set((existing ?? []).map((g) => g.team_id));

  let sealed = 0;
  let skipped = 0;
  for (const team of teams) {
    if (alreadySealed.has(team.id)) {
      skipped++;
      continue;
    }
    const result = await sealClamsGrade(phaseId, team.id);
    if (result.ok) {
      sealed++;
    } else if (result.needsApiKey) {
      // No point trying the other eleven.
      return { ok: false, sealed, skipped, error: result.error, needsApiKey: true };
    } else {
      skipped++;
    }
  }

  return { ok: true, sealed, skipped };
}
