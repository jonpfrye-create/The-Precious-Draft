import { isPositionDraftable, type SlotSpec } from "./roster-fit";

/**
 * Picks best-available for a team, skipping anyone they have no roster slot
 * left for.
 *
 * "Best available" means first in the list, so the caller decides what best
 * means by how it sorts - in practice sortByDraftability, the same order
 * the board shows. Shared by the simulate script and the demo button so
 * they can't drift into simulating two different drafts.
 */
export function chooseAutoPick<
  T extends { player_id: string; position: string | null },
>(
  availableInPriorityOrder: readonly T[],
  draftedPositions: readonly (string | null)[],
  slots: readonly SlotSpec[]
): T | null {
  for (const player of availableInPriorityOrder) {
    if (isPositionDraftable(draftedPositions, player.position, slots)) {
      return player;
    }
  }
  return null;
}

// The one league the demo and simulation tools are allowed to touch. They
// write picks, so the guard is a hard equality check on the name rather
// than anything inferred - the real draft must be untouchable by
// construction, not by being careful.
export const DEMO_LEAGUE_NAME = "ZZZ Draw Test";

export function isDemoLeague(leagueName: string): boolean {
  return leagueName === DEMO_LEAGUE_NAME;
}
