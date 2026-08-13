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
  positions: readonly (string | null)[],
  slots: readonly SlotSpec[]
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
  draftedPositions: readonly (string | null)[],
  slots: readonly SlotSpec[]
): boolean {
  if (draftedPositions.length > slots.length) return false;
  return maximumMatching(draftedPositions, slots) === draftedPositions.length;
}

/**
 * Whether a team may draft a player of this position right now, given what
 * they already have.
 */
export function isPositionDraftable(
  draftedPositions: readonly (string | null)[],
  candidatePosition: string | null,
  slots: readonly SlotSpec[]
): boolean {
  return canFillRoster([...draftedPositions, candidatePosition], slots);
}

/**
 * Which of `positions` this team could still legally draft. Drives the
 * board's greying-out and the "you still need a K" messaging, so the room
 * finds out before the pick is called rather than after.
 */
export function draftablePositions(
  draftedPositions: readonly (string | null)[],
  slots: readonly SlotSpec[],
  positions: readonly string[]
): string[] {
  return positions.filter((position) =>
    isPositionDraftable(draftedPositions, position, slots)
  );
}

export interface SlotAssignment<T> {
  slot: SlotSpec;
  player: T | null;
}

/**
 * Actually places players into slots, rather than just proving it's
 * possible. This is what the end-of-phase output needs: Yahoo wants a
 * roster read out slot by slot, and "these nine players fit somehow" isn't
 * a thing anyone can type in.
 *
 * Two orderings decide which of several valid arrangements comes out, and
 * both exist to make the result the one a human would have written:
 *
 *   - players are placed in the order given, which is pick order, so
 *     earlier picks get first claim on a starting slot. Without this a
 *     team that drafted four running backs could see its first-round pick
 *     assigned to the bench while a later pick starts - technically a
 *     valid matching, and obviously wrong to anyone reading it.
 *   - each player takes the most restrictive slot they fit, so a running
 *     back fills RB1 before FLEX, and FLEX before a bench slot. Bench
 *     slots accept every position, so they sort last automatically.
 *
 * The result is still a maximum matching; the orderings only choose
 * between equally valid ones.
 */
export function assignRoster<T extends { position: string | null }>(
  players: readonly T[],
  slots: readonly SlotSpec[]
): SlotAssignment<T>[] {
  // Most restrictive slots first; declared order breaks ties so the result
  // is deterministic.
  const slotPreference = slots
    .map((slot, index) => ({ slot, index }))
    .sort(
      (a, b) =>
        a.slot.eligiblePositions.length - b.slot.eligiblePositions.length ||
        a.index - b.index
    )
    .map((entry) => entry.index);

  const playerToSlot = new Array<number>(players.length).fill(-1);
  const slotToPlayer = new Array<number>(slots.length).fill(-1);

  function tryPlace(player: number, seen: boolean[]): boolean {
    for (const slotIndex of slotPreference) {
      if (
        seen[slotIndex] ||
        !slotAccepts(slots[slotIndex], players[player].position)
      ) {
        continue;
      }
      seen[slotIndex] = true;
      // Either the slot is free, or whoever holds it can move on.
      if (
        slotToPlayer[slotIndex] === -1 ||
        tryPlace(slotToPlayer[slotIndex], seen)
      ) {
        playerToSlot[player] = slotIndex;
        slotToPlayer[slotIndex] = player;
        return true;
      }
    }
    return false;
  }

  // Pass one: give each player, in pick order, the best slot that's still
  // free. No displacement, so an earlier pick can never be shoved aside by
  // a later one - which is what running the augmenting search from the
  // start would do, benching first-rounders in favour of late picks.
  for (let player = 0; player < players.length; player++) {
    for (const slotIndex of slotPreference) {
      if (
        slotToPlayer[slotIndex] === -1 &&
        slotAccepts(slots[slotIndex], players[player].position)
      ) {
        playerToSlot[player] = slotIndex;
        slotToPlayer[slotIndex] = player;
        break;
      }
    }
  }

  // Pass two: anyone still unplaced gets the full search, which may shuffle
  // others along. Greedy alone isn't enough - a player who fits only one
  // slot can find it already taken by someone who had alternatives, and
  // only displacement recovers that. Restricted to unplaced players, so
  // shuffling happens only when it's the difference between a player
  // having a slot and having none.
  for (let player = 0; player < players.length; player++) {
    if (playerToSlot[player] === -1) {
      tryPlace(player, new Array<boolean>(slots.length).fill(false));
    }
  }

  return slots.map((slot, index) => ({
    slot,
    player: slotToPlayer[index] === -1 ? null : players[slotToPlayer[index]],
  }));
}

/**
 * Players who couldn't be placed in any slot. Should always be empty for a
 * roster built through the board, since makePick refuses picks that don't
 * fit - but the export says so rather than silently dropping someone.
 */
export function unassignedPlayers<T extends { position: string | null }>(
  players: readonly T[],
  slots: readonly SlotSpec[]
): T[] {
  const assigned = new Set(
    assignRoster(players, slots)
      .map((a) => a.player)
      .filter((p): p is T => p !== null)
  );
  return players.filter((p) => !assigned.has(p));
}

/**
 * Positions the team is now obliged to take, because there are exactly as
 * many picks left as slots and those slots only accept these.
 *
 * Returns an empty array when nothing is forced yet. When a team's last
 * pick must be a kicker, this is what says so.
 */
export function forcedPositions(
  draftedPositions: readonly (string | null)[],
  slots: readonly SlotSpec[],
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
