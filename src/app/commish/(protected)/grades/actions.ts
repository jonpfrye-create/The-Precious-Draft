"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import { isGrade } from "@/lib/draft/grades";
import { getPhaseById } from "@/lib/draft/queries";

export interface SaveGradeResult {
  ok: boolean;
  error?: string;
}

/**
 * Records the commissioner's grade for one team's draft.
 *
 * Written per source, so adding a generated grade later sits alongside
 * this one instead of replacing it.
 */
export async function saveGrade(
  phaseId: string,
  teamId: string,
  grade: string,
  comment: string
): Promise<SaveGradeResult> {
  const league = await requireCommissionerLeagueForAction();

  const phase = await getPhaseById(phaseId);
  if (!phase) return { ok: false, error: "Phase not found" };
  if (phase.league_id !== league.id) {
    return { ok: false, error: "That phase belongs to a different league" };
  }
  if (!isGrade(grade)) {
    return { ok: false, error: `"${grade}" isn't a grade.` };
  }

  const supabase = createAdminSupabaseClient();

  // The team has to be in this league, or a crafted request could attach a
  // grade to someone else's team.
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("league_id", league.id)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team) return { ok: false, error: "That team isn't in this league." };

  const { error } = await supabase.from("team_grades").upsert(
    {
      phase_id: phaseId,
      team_id: teamId,
      source: "commissioner",
      grade,
      comment: comment.trim() || null,
      updated_at: new Date().toISOString(),
    },
    // Matches the UNIQUE constraint, so re-grading updates rather than
    // stacking up duplicates.
    { onConflict: "phase_id,team_id,source" }
  );
  if (error) throw error;

  return { ok: true };
}
