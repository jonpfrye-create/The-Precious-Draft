/**
 * A pick written the way this league says it out loud: round, then the
 * pick's place within that round. Pick 30 of a twelve-team draft is 3.06,
 * not 3.30 - the second number counts within the round, never overall.
 *
 * Written down once because the phone board and the grade cards had
 * drifted into two different answers, and the phone's was wrong.
 */
export function pickInRound(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0) return pickNumber;
  return ((pickNumber - 1) % teamCount) + 1;
}

export function pickLabel(
  pickNumber: number,
  round: number,
  teamCount: number
): string {
  return `${round}.${String(pickInRound(pickNumber, teamCount)).padStart(2, "0")}`;
}
