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
  /**
   * Whether an order currently exists - `phases.order_drawn_at` being
   * set, which is the same signal the button on screen reads.
   *
   * Deliberately not `order_draw_count`. That is the honesty counter: it
   * only ever goes up, and it stays up even if the order it counted is
   * gone. Judging a redraw by it meant the page offered a plain "Draw
   * the draft order" button while the action behind it quietly demanded
   * the REDRAW phrase, so pressing it did nothing anyone could explain.
   * There is no order to redraw when nothing has been drawn.
   */
  hasBeenDrawn: boolean;
}): DrawDecision {
  if (input.picksMade > 0) {
    return {
      allowed: false,
      reason:
        "The draft has already started — the order is locked. Undo every pick first if it genuinely has to change.",
    };
  }
  return { allowed: true, requiresConfirmation: input.hasBeenDrawn };
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
  // Positions uncovered by this click. Always exactly one.
  positions: number[];
  // Total revealed once this step lands - what gets stored on the phase.
  revealedAfter: number;
  // This click reveals the first overall pick: fanfare and confetti.
  isFinale: boolean;
  // Only pick 1 is left after this click. The room can already work out who
  // it is by elimination, so the UI stops and makes a moment of it rather
  // than rolling straight on.
  setsUpFinale: boolean;
}

/**
 * Works out what the next click reveals.
 *
 * The order is uncovered from the last pick upwards, one pick per click,
 * all the way down to 1. Every reveal is its own button press - an earlier
 * version revealed 2 and 1 together, which broke the rhythm and left the
 * room unsure whether the last card was still coming.
 *
 * Pick 1 is still special: once pick 2 is named there is exactly one team
 * unaccounted for, so the room works it out before the screen says it. The
 * gap between those two clicks is the tension, and `setsUpFinale` is what
 * tells the UI to hold there.
 *
 * Returns null when everything is already revealed.
 */
export function nextRevealStep(
  totalTeams: number,
  revealedSoFar: number
): RevealStep | null {
  if (totalTeams < 1) return null;
  if (revealedSoFar >= totalTeams) return null;

  const position = totalTeams - revealedSoFar;
  return {
    positions: [position],
    revealedAfter: revealedSoFar + 1,
    isFinale: position === 1,
    setsUpFinale: position === 2,
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
