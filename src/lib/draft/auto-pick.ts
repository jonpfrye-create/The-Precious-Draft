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

// Demo leagues are named by prefix so more than one can exist at a time -
// handing the commissioner his own means he can't reset yours out from
// under you halfway through a test, and you won't fight over whose turn
// the board is showing.
//
// The demo tools write and delete picks, so the guard is a literal prefix
// check rather than anything inferred. Nothing about a real league's name
// can accidentally satisfy it, and the prefix is ugly on purpose: it is
// not a name anyone would pick for a real draft.
export const DEMO_LEAGUE_PREFIX = "ZZZ ";
export const DEMO_LEAGUE_NAME = "ZZZ Draw Test";

export function isDemoLeague(leagueName: string): boolean {
  return leagueName.startsWith(DEMO_LEAGUE_PREFIX);
}
