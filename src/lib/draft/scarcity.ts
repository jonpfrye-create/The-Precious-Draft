import type { SlotSpec } from "./roster-fit";

export interface ScarcityWarning {
  position: string;
  /** How many the phase needs in total, across every team. */
  needed: number;
  /** How many are left in the pool. */
  available: number;
}

/**
 * Warns when a phase can't possibly fill everyone's roster.
 *
 * The real case: Leftovers gives every team a QB slot, but the pool has
 * already been picked over by Main. If twelve teams took two quarterbacks
 * each and nine teams stay for Leftovers, there may not be nine
 * quarterbacks left - and a team with no starting QB takes a huge weekly
 * penalty. The league's fix is to release the last quarterback drafted in
 * Main back into the pool, which needs someone to notice first.
 *
 * Only single-position slots are counted. A FLEX slot takes any of three
 * positions, so it can't be short of one in particular, and a bench slot
 * takes anything at all.
 */
export function scarcityWarnings(
  slots: readonly SlotSpec[],
  teamCount: number,
  availableByPosition: Readonly<Record<string, number>>
): ScarcityWarning[] {
  if (teamCount <= 0) return [];

  const neededPerTeam = new Map<string, number>();
  for (const slot of slots) {
    // A slot that accepts more than one position can always be filled from
    // whichever of them is left.
    if (slot.eligiblePositions.length !== 1) continue;
    const position = slot.eligiblePositions[0];
    neededPerTeam.set(position, (neededPerTeam.get(position) ?? 0) + 1);
  }

  const warnings: ScarcityWarning[] = [];
  for (const [position, perTeam] of neededPerTeam) {
    const needed = perTeam * teamCount;
    const available = availableByPosition[position] ?? 0;
    if (available < needed) {
      warnings.push({ position, needed, available });
    }
  }

  // Worst shortfall first - that's the one to deal with.
  return warnings.sort(
    (a, b) => a.available - a.needed - (b.available - b.needed)
  );
}
