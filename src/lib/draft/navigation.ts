import "server-only";
import { destinationFor } from "./navigation-rules";
import { getCurrentPhase, getPhasesForLeague } from "./queries";

/**
 * Where a commissioner should land, given what state their league is in.
 *
 * This exists because the answer was written out separately on the entry
 * page and the board, and only one of them got updated when phase
 * transitions arrived. The board went on sending "no phase in progress" to
 * /commish/setup - which, once a league exists, is a blank new-league form.
 * Finishing the Main draft therefore looked like the whole league had been
 * wiped, and filling that form in would have created a second one.
 *
 * One function, used by every route that has to make this decision.
 */
export async function commissionerDestination(
  leagueId: string
): Promise<string> {
  const phase = await getCurrentPhase(leagueId);
  if (phase) return destinationFor(true, 0);

  const phases = await getPhasesForLeague(leagueId);
  return destinationFor(false, phases.length);
}
