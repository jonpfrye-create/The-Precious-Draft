import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { teamForClaimToken, type ClaimedTeam } from "./claims";

/**
 * The drafter session: one browser, one team.
 *
 * Deliberately separate from the commissioner cookie rather than a role
 * on a shared one. The commissioner is also a drafter - he has a team
 * like everyone else - and on draft night he may well have the board open
 * on a laptop and his own team open on his phone. Two cookies means those
 * two things never have to agree.
 */

export const DRAFTER_COOKIE_NAME = "pd_team";

// Long enough to cover Main, Leftovers and Microwave with the phone in a
// pocket in between, and the gap between drafts in later years.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function drafterCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export async function startDrafterSession(token: string): Promise<void> {
  const store = await cookies();
  store.set(DRAFTER_COOKIE_NAME, token, drafterCookieOptions());
}

export async function endDrafterSession(): Promise<void> {
  const store = await cookies();
  store.delete(DRAFTER_COOKIE_NAME);
}

/**
 * The team this browser has claimed, or null.
 *
 * Re-resolved from the database every request, so a claim the
 * commissioner releases stops working immediately rather than lasting
 * until the cookie expires.
 */
export async function getDrafterTeam(): Promise<ClaimedTeam | null> {
  const store = await cookies();
  const token = store.get(DRAFTER_COOKIE_NAME)?.value;
  if (!token) return null;
  return teamForClaimToken(token);
}

/** For pages. Sends anyone without a claim back to the front door. */
export async function requireDrafterTeam(): Promise<ClaimedTeam> {
  const team = await getDrafterTeam();
  if (!team) redirect("/join");
  return team;
}

/**
 * The league code a browser has entered.
 *
 * A step short of a claim: the code gets you the list of teams and
 * nothing else. It has to be remembered between entering it and picking
 * a team, and it stays afterwards so someone who loses their claim can
 * get back to the list without asking anyone for the code again.
 */
export const LEAGUE_COOKIE_NAME = "pd_league";

export async function startLeagueSession(code: string): Promise<void> {
  const store = await cookies();
  store.set(LEAGUE_COOKIE_NAME, code, drafterCookieOptions());
}

export async function getLeagueCodeFromSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(LEAGUE_COOKIE_NAME)?.value ?? null;
}

/**
 * For server actions, which never run a page's layout and so have to
 * establish who is asking for themselves. Returns null rather than
 * redirecting, because the caller has to combine this with commissioner
 * access before deciding - see lib/draft/pick-permission.ts.
 */
export async function getDrafterTeamForAction(): Promise<ClaimedTeam | null> {
  return getDrafterTeam();
}
