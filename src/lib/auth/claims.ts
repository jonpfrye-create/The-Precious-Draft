import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Team claims: how a phone proves it is allowed to pick for one team.
 *
 * The league code is shared with everybody, so it cannot be the thing
 * that authorises a pick - it only gets you as far as the list of teams.
 * Claiming a team mints a per-team token, which lives in that browser's
 * cookie and is what makePick actually checks.
 *
 * Claims are per team, not per phase (see CLAUDE.md): claim once, and it
 * carries into Leftovers and Microwave automatically. There is deliberately
 * no per-phase claim row to fall out of step.
 *
 * `team_claims` has RLS on with zero policies, so the anon key in every
 * browser can neither read a token nor write a row - verified, not
 * assumed. Everything here goes through the service role.
 */

export interface ClaimedTeam {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
}

/**
 * Never read aloud, only ever stored in a cookie, so this is raw entropy
 * rather than the Crockford alphabet the league code uses.
 */
function generateClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Which teams in a league are already taken. Tokens never leave here. */
export async function claimedTeamIds(leagueId: string): Promise<Set<string>> {
  const supabase = createAdminSupabaseClient();
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", leagueId);
  if (teamsError) throw teamsError;

  const ids = (teams ?? []).map((t) => t.id);
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from("team_claims")
    .select("team_id")
    .in("team_id", ids);
  if (error) throw error;
  return new Set((data ?? []).map((c) => c.team_id));
}

export type ClaimResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Takes a team on behalf of a browser.
 *
 * The unique constraint on team_id is what actually prevents two people
 * claiming the same team - checking first and inserting after would leave
 * a gap between the two, and twelve people tapping at once on draft night
 * is exactly when that gap gets found.
 */
export async function claimTeam(
  leagueId: string,
  teamId: string
): Promise<ClaimResult> {
  const supabase = createAdminSupabaseClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("league_id", leagueId)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team) return { ok: false, error: "That team isn't in this league." };

  const token = generateClaimToken();
  const { error } = await supabase
    .from("team_claims")
    .insert({ team_id: teamId, claim_token: token });

  if (error) {
    // 23505 is a unique violation: somebody got there first.
    if (error.code === "23505") {
      return { ok: false, error: "Somebody already claimed that team." };
    }
    throw error;
  }

  return { ok: true, token };
}

/** Resolves a cookie token back to the team it claims. */
export async function teamForClaimToken(
  token: string
): Promise<ClaimedTeam | null> {
  if (!token) return null;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("team_claims")
    .select("team_id, teams (id, name, league_id, leagues (id, name))")
    .eq("claim_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const team = data.teams as unknown as {
    id: string;
    name: string;
    league_id: string;
    leagues: { id: string; name: string };
  } | null;
  if (!team) return null;

  return {
    teamId: team.id,
    teamName: team.name,
    leagueId: team.league_id,
    leagueName: team.leagues?.name ?? "",
  };
}

/**
 * Hands a team back to the pool.
 *
 * Needed because the league code lets anyone claim any free team, so the
 * first mis-tap of the night puts somebody on the wrong roster with no
 * way out. The commissioner can undo it; the browser that held it simply
 * stops being recognised.
 */
export async function releaseClaim(
  leagueId: string,
  teamId: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("league_id", leagueId)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team) return;

  const { error } = await supabase
    .from("team_claims")
    .delete()
    .eq("team_id", teamId);
  if (error) throw error;
}
