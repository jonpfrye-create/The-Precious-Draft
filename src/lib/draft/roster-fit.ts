export interface SlotSpec {
  slotName: string;
  eligiblePositions: string[];
}

/**
 * Roster rules, expressed as one question: can every player a team has
 * drafted be assigned to a distinct roster slot it's eligible for?
 *
 * The league's rules fall out of that single check rather than needing to
 * be written down separately:
 *
 *   - "you can only have one kicker" - a second kicker has no second slot
 *     to go in, so the assignment fails and the pick is refused
 *   - "you have to draft one" - by the last round the only unfilled slot
 *     is K, so anything that isn't a kicker can't be assigned either
 *
 * Neither rule is special-cased anywhere. Change the roster shape and the
 * constraints change with it, which is what makes this work unchanged for
 * Main (bench slots absorb almost anything) and Leftovers (no bench, so
 * every slot is binding).
 */

function slotAccepts(slot: SlotSpec, position: string | null): boolean {
  if (!position) return false;
  return slot.eligiblePositions.includes(position);
}

/**
 * Standard augmenting-path bipartite matching. Rosters are at most ~15
 * slots, so the simple O(V*E) version is far below the point where
 * anything cleverer would matter.
 */
function maximumMatching(
  positions: (string | null)[],
  slots: SlotSpec[]
): number {
  // slotToPlayer[i] is the index of the player currently occupying slot i.
  const slotToPlayer = new Array<number>(slots.length).fill(-1);

  function tryAssign(player: number, seen: boolean[]): boolean {
    for (let slot = 0; slot < slots.length; slot++) {
      if (seen[slot] || !slotAccepts(slots[slot], positions[player])) continue;
      seen[slot] = true;
      // Either the slot is free, or whoever's in it can move elsewhere.
      if (
        slotToPlayer[slot] === -1 ||
        tryAssign(slotToPlayer[slot], seen)
      ) {
        slotToPlayer[slot] = player;
        return true;
      }
    }
    return false;
  }

  let matched = 0;
  for (let player = 0; player < positions.length; player++) {
    if (tryAssign(player, new Array<boolean>(slots.length).fill(false))) {
      matched++;
    }
  }
  return matched;
}

/**
 * True when every drafted player can be placed in a distinct eligible slot.
 * A team with more players than slots always fails.
 */
export function canFillRoster(
  draftedPositions: (string | null)[],
  slots: SlotSpec[]
): boolean {
  if (draftedPositions.length > slots.length) return false;
  return maximumMatching(draftedPositions, slots) === draftedPositions.length;
}

/**
 * Whether a team may draft a player of this position right now, given what
 * they already have.
 */
export function isPositionDraftable(
  draftedPositions: (string | null)[],
  candidatePosition: string | null,
  slots: SlotSpec[]
): boolean {
  return canFillRoster([...draftedPositions, candidatePosition], slots);
}

/**
 * Which of `positions` this team could still legally draft. Drives the
 * board's greying-out and the "you still need a K" messaging, so the room
 * finds out before the pick is called rather than after.
 */
export function draftablePositions(
  draftedPositions: (string | null)[],
  slots: SlotSpec[],
  positions: readonly string[]
): string[] {
  return positions.filter((position) =>
    isPositionDraftable(draftedPositions, position, slots)
  );
}

/**
 * Positions the team is now obliged to take, because there are exactly as
 * many picks left as slots and those slots only accept these.
 *
 * Returns an empty array when nothing is forced yet. When a team's last
 * pick must be a kicker, this is what says so.
 */
export function forcedPositions(
  draftedPositions: (string | null)[],
  slots: SlotSpec[],
  positions: readonly string[]
): string[] {
  const remaining = slots.length - draftedPositions.length;
  if (remaining <= 0) return [];

  const draftable = draftablePositions(draftedPositions, slots, positions);
  // Nothing is forced while there's slack: with more picks left than any
  // single requirement, the team can still choose freely.
  if (draftable.length === positions.length) return [];
  return draftable;
}
