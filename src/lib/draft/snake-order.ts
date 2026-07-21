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

// Given how many picks have already been made, returns the pick that's
// currently on the clock — or null once the phase is complete.
export function currentPick(
  picks: SnakePick[],
  picksMadeCount: number
): SnakePick | null {
  return picks[picksMadeCount] ?? null;
}
