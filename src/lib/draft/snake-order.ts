export interface SnakePick {
  overallPick: number; // 1-based, across the whole phase
  round: number; // 1-based
  pickInRound: number; // 1-based position within the round
  teamId: string;
}

// Generates the full pick order for a phase: odd rounds go in the given
// team order, even rounds reverse it. Works for any team count and any
// number of rounds — Leftovers and Microwave both use subsets of teams
// decided at phase start, so this can never assume a fixed count.
export function generateSnakeOrder(
  teamIds: string[],
  rounds: number
): SnakePick[] {
  if (teamIds.length === 0) {
    throw new Error("generateSnakeOrder requires at least one team");
  }
  if (rounds < 1) {
    throw new Error("generateSnakeOrder requires at least one round");
  }

  const picks: SnakePick[] = [];
  let overallPick = 1;
  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? teamIds : [...teamIds].reverse();
    for (const [index, teamId] of order.entries()) {
      picks.push({ overallPick, round, pickInRound: index + 1, teamId });
      overallPick++;
    }
  }
  return picks;
}

/**
 * Every overall pick number a given draft position owns, across the phase.
 *
 * Position 7 of 12 picks 7th, then 18th (the snake turns around), then
 * 31st, and so on. Computed directly rather than by walking the generated
 * order, because this runs on the reveal card for each team; a test pins it
 * against generateSnakeOrder so the two can never disagree.
 */
export function pickNumbersForPosition(
  totalTeams: number,
  rounds: number,
  draftPosition: number
): number[] {
  if (totalTeams < 1 || rounds < 1) return [];
  if (draftPosition < 1 || draftPosition > totalTeams) return [];

  const picks: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    const positionInRound =
      round % 2 === 1 ? draftPosition : totalTeams - draftPosition + 1;
    picks.push((round - 1) * totalTeams + positionInRound);
  }
  return picks;
}

// Given how many picks have already been made, returns the pick that's
// currently on the clock — or null once the phase is complete.
export function currentPick(
  picks: SnakePick[],
  picksMadeCount: number
): SnakePick | null {
  return picks[picksMadeCount] ?? null;
}
