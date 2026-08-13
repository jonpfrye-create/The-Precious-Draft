/**
 * Where a commissioner belongs, given the state of their league.
 *
 * Split out from navigation.ts - which is server-only and hits the
 * database - so the decision itself can be tested. This is the logic that
 * was wrong: "no phase in progress" was being treated as "nothing has been
 * set up", which sent a commissioner who had just finished the Main draft
 * to a blank new-league form. It looked like the league had been wiped,
 * and filling the form in would have created a second one.
 */
export function destinationFor(
  hasCurrentPhase: boolean,
  phaseCount: number
): string {
  // Something is being drafted right now.
  if (hasCurrentPhase) return "/commish/board";

  // Nothing has ever been set up: this really is a new league.
  if (phaseCount === 0) return "/commish/setup";

  // A phase just finished. The next one needs configuring - the league is
  // very much still there.
  return "/commish/next-phase";
}
