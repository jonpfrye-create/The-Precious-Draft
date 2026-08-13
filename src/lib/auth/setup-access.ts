import "server-only";
import { getCommissionerLeague } from "./commissioner";
import { countLeagues } from "@/lib/draft/queries";

// Setup is the one commissioner route that cannot simply require a
// commissioner secret, because on a brand-new database no secret exists
// yet - the first league is what mints one. So it opens exactly once:
//
//   - zero leagues in the database -> anyone may create the first one
//   - one or more leagues          -> commissioner secret required
//
// The open window closes permanently the moment the first league is
// created, and it only exists before the URL has been shared with anyone.
export type SetupAccess =
  | { allowed: true; reason: "bootstrap" }
  | { allowed: true; reason: "commissioner"; leagueId: string }
  | { allowed: false };

export async function checkSetupAccess(): Promise<SetupAccess> {
  const league = await getCommissionerLeague();
  if (league) {
    return { allowed: true, reason: "commissioner", leagueId: league.id };
  }
  if ((await countLeagues()) === 0) {
    return { allowed: true, reason: "bootstrap" };
  }
  return { allowed: false };
}
