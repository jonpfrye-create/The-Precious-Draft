"use server";

import { redirect } from "next/navigation";
import { normalizeCode, isValidLeagueCodeShape } from "@/lib/auth/codes";
import { findLeagueIdByLeagueCode } from "@/lib/auth/secrets";
import { claimTeam } from "@/lib/auth/claims";
import {
  getLeagueCodeFromSession,
  startDrafterSession,
  startLeagueSession,
} from "@/lib/auth/drafter";

/**
 * Getting a phone from nothing to holding a team.
 *
 * Two steps on purpose. The league code is shared with the whole room and
 * gets you no further than the list of names; taking a team mints a token
 * that only that browser has, and that token is what makePick checks. If
 * the code alone authorised picks, anyone who overheard it could draft
 * for anybody.
 */

export interface JoinResult {
  ok: boolean;
  error?: string;
}

export async function enterLeagueCode(raw: string): Promise<JoinResult> {
  const code = normalizeCode(raw);
  if (!isValidLeagueCodeShape(code)) {
    return { ok: false, error: "That doesn't look like a league code." };
  }

  const leagueId = await findLeagueIdByLeagueCode(code);
  if (!leagueId) {
    return { ok: false, error: "No league has that code." };
  }

  await startLeagueSession(code);
  return { ok: true };
}

export async function claimTeamAction(teamId: string): Promise<JoinResult> {
  // The code is re-checked here rather than trusted from the page that
  // rendered the button: a server action is its own HTTP endpoint and
  // never runs the page that led to it.
  const code = await getLeagueCodeFromSession();
  const leagueId = code ? await findLeagueIdByLeagueCode(code) : null;
  if (!leagueId) {
    return { ok: false, error: "Enter the league code first." };
  }

  const result = await claimTeam(leagueId, teamId);
  if (!result.ok) return { ok: false, error: result.error };

  await startDrafterSession(result.token);
  redirect("/draft");
}
