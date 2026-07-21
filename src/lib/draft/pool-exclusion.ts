export interface PhasePicks {
  sequence: number;
  playerIds: string[];
}

// Union of every player_id picked in a phase with a lower sequence number
// than targetSequence. This is what makes exclusion cascade: Leftovers
// (sequence 2) excludes Main (sequence 1); Microwave (sequence 3)
// excludes both Main and Leftovers.
export function excludedPlayerIds(
  priorPhasePicks: PhasePicks[],
  targetSequence: number
): Set<string> {
  const excluded = new Set<string>();
  for (const phase of priorPhasePicks) {
    if (phase.sequence < targetSequence) {
      for (const id of phase.playerIds) excluded.add(id);
    }
  }
  return excluded;
}

// Full "what's available to pick right now" for a phase: the master pool,
// minus everyone picked in an earlier phase, minus anyone already picked
// earlier in this same phase.
export function availablePlayersForPhase<T extends { player_id: string }>(
  allPlayers: T[],
  priorPhasePicks: PhasePicks[],
  targetSequence: number,
  alreadyPickedThisPhase: Iterable<string> = []
): T[] {
  const excluded = excludedPlayerIds(priorPhasePicks, targetSequence);
  for (const id of alreadyPickedThisPhase) excluded.add(id);
  return allPlayers.filter((p) => !excluded.has(p.player_id));
}
