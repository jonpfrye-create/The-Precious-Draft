import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeCode } from "./codes";
import { findLeagueIdByCommissionerSecret } from "./secrets";
import { getLeagueById, type League } from "@/lib/draft/queries";

export const COMMISSIONER_COOKIE_NAME = "pd_commish";

// The draft runs on a laptop that gets closed between phases and may sit
// idle for weeks between Main and Microwave. Signing the commissioner out
// mid-draft would be worse than the marginal risk of a long-lived cookie
// on their own machine.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// The cookie stores the secret itself rather than a derived session id.
// There is no session table and no accounts, so the secret *is* the
// credential - and because it's re-checked against the database on every
// request, deleting the league_secrets row revokes access immediately.
//
// Exported so the /commish/enter route handler sets an identical cookie -
// it builds its own response rather than going through cookies(), and the
// two must not drift apart.
export function commissionerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export async function startCommissionerSession(secret: string): Promise<void> {
  const store = await cookies();
  store.set(COMMISSIONER_COOKIE_NAME, secret, commissionerCookieOptions());
}

export async function endCommissionerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COMMISSIONER_COOKIE_NAME);
}

// Checks a secret the user just supplied (from the link or the paste box).
// Returns the league it unlocks, or null.
export async function verifyCommissionerSecret(
  rawSecret: string
): Promise<League | null> {
  const secret = normalizeCode(rawSecret ?? "");
  if (!secret) return null;
  const leagueId = await findLeagueIdByCommissionerSecret(secret);
  if (!leagueId) return null;
  return getLeagueById(leagueId);
}

// The league this browser is currently signed in as commissioner of, or
// null. Re-validated against the database every call - a cookie holding a
// secret that no longer exists is worth nothing.
export async function getCommissionerLeague(): Promise<League | null> {
  const store = await cookies();
  const secret = store.get(COMMISSIONER_COOKIE_NAME)?.value;
  if (!secret) return null;
  const leagueId = await findLeagueIdByCommissionerSecret(secret);
  if (!leagueId) return null;
  return getLeagueById(leagueId);
}

// The gate. Call this at the top of every commissioner-only page AND at
// the top of every commissioner-only server action.
//
// Guarding the pages alone is not enough: server actions are reachable as
// plain HTTP POSTs to a generated endpoint, so an unauthenticated caller
// who knows the action id could otherwise enter or undo picks without ever
// loading a gated page. Rendering a page and invoking an action are two
// separate requests, and both have to be checked.
export async function requireCommissionerLeague(): Promise<League> {
  const league = await getCommissionerLeague();
  if (!league) redirect("/commish/login");
  return league;
}

// Same check, for server actions. Throws instead of redirecting, since a
// redirect out of an action the caller was never allowed to invoke just
// muddies the error.
export async function requireCommissionerLeagueForAction(): Promise<League> {
  const league = await getCommissionerLeague();
  if (!league) {
    throw new Error(
      "Commissioner access required. Open your commissioner link and try again."
    );
  }
  return league;
}
