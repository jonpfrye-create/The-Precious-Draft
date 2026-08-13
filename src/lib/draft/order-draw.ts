import { randomInt } from "node:crypto";

// The phrase a commissioner has to type to unlock a redraw. Deliberately
// something you can't produce by mashing the keyboard or double-clicking a
// button, because the whole point of the redraw gate is that it can't
// happen by accident or in a hurry.
export const REDRAW_CONFIRMATION = "REDRAW";

export type DrawDecision =
  | { allowed: true; requiresConfirmation: boolean }
  | { allowed: false; reason: string };

/**
 * Decides whether the draft order may be drawn right now.
 *
 * The rules exist to answer one question from the room: "how do we know you
 * didn't keep rolling until you got the first pick?"
 *
 *   - Never once drafting has started. Redrawing then would orphan picks
 *     that have already been made, so there is no override for this.
 *   - The first draw is free.
 *   - Every later draw needs the confirmation phrase, and the count is
 *     shown on the board forever after - a redraw is always possible, but
 *     never invisible.
 */
export function evaluateDrawRequest(input: {
  picksMade: number;
  drawCount: number;
}): DrawDecision {
  if (input.picksMade > 0) {
    return {
      allowed: false,
      reason:
        "The draft has already started — the order is locked. Undo every pick first if it genuinely has to change.",
    };
  }
  return { allowed: true, requiresConfirmation: input.drawCount > 0 };
}

/**
 * Unbiased Fisher-Yates. Takes its randomness as a parameter so tests can
 * pin it down; defaults to crypto's rejection-sampled randomInt rather
 * than Math.random, which is neither uniform enough nor unpredictable
 * enough for something the league is going to argue about.
 */
export function shuffle<T>(
  items: readonly T[],
  randomIntFn: (max: number) => number = randomInt
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIntFn(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RevealStep {
  // Positions uncovered by this click. Always one, except the finale.
  positions: number[];
  // Total revealed once this step lands - what gets stored on the phase.
  revealedAfter: number;
  // The last click of the draw: reveals picks 2 and 1 together.
  isFinale: boolean;
}

/**
 * Works out what the next click reveals.
 *
 * The order is uncovered from the last pick upwards, and stops one short:
 * once pick 2 is named there is only one team left unaccounted for, so the
 * room has already worked out who has pick 1. Rather than pretend
 * otherwise, the final click reveals 2 and 1 together and treats that as
 * the moment of the night.
 *
 * Returns null when everything is already revealed.
 */
export function nextRevealStep(
  totalTeams: number,
  revealedSoFar: number
): RevealStep | null {
  if (totalTeams < 1) return null;
  if (revealedSoFar >= totalTeams) return null;

  // With two teams left unrevealed, naming one names both.
  if (revealedSoFar === totalTeams - 2) {
    return { positions: [2, 1], revealedAfter: totalTeams, isFinale: true };
  }

  const position = totalTeams - revealedSoFar;
  return {
    positions: [position],
    revealedAfter: revealedSoFar + 1,
    isFinale: false,
  };
}

// Which draft positions are visible given how many have been revealed.
// Reveals run from the bottom up, so revealing 3 of 12 means positions
// 12, 11 and 10 are out.
export function isPositionRevealed(
  totalTeams: number,
  revealedSoFar: number,
  draftPosition: number
): boolean {
  return draftPosition > totalTeams - revealedSoFar;
}

export interface DraftPosition {
  teamId: string;
  draftPosition: number;
}

// Turns a shuffled team list into the 1-based draft positions that go into
// phase_teams.
export function assignDraftPositions(teamIds: readonly string[]): DraftPosition[] {
  return teamIds.map((teamId, index) => ({
    teamId,
    draftPosition: index + 1,
  }));
}
