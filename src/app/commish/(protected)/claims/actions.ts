"use server";

import { requireCommissionerLeagueForAction } from "@/lib/auth/commissioner";
import { releaseClaim } from "@/lib/auth/claims";

export interface ReleaseResult {
  ok: boolean;
  error?: string;
}

/**
 * Hands a team back to the pool.
 *
 * The league code lets anyone claim any free team, which means the first
 * mis-tap of the night puts somebody on the wrong roster with no way out
 * on their own. Only the commissioner can undo it - a drafter releasing
 * claims would let anyone knock anyone else off their team.
 */
export async function releaseTeamClaim(
  teamId: string
): Promise<ReleaseResult> {
  const league = await requireCommissionerLeagueForAction();
  await releaseClaim(league.id, teamId);
  return { ok: true };
}
