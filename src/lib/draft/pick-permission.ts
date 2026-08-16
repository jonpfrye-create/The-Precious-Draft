/**
 * Who is allowed to make a given pick.
 *
 * Everyone drafts from their own phone now, in the room or not, so
 * makePick stops being a commissioner-only action and becomes the one
 * place two very different callers meet. The rule is small enough to
 * state in full and important enough to test rather than infer from the
 * shape of an if-statement:
 *
 *   - the commissioner may pick for any team at any time, because
 *     somebody's phone will die and the draft cannot stop for it
 *   - a drafter may pick only for the team they have claimed, and only
 *     while that team is on the clock
 *
 * Nothing here reads the database. The caller establishes who is asking;
 * this decides whether they may.
 */

export interface PickRequest {
  /** True when the request carries a valid commissioner session. */
  isCommissioner: boolean;
  /** The team this browser has claimed, if any. */
  claimedTeamId: string | null;
  /** The team the pick is being made for. */
  forTeamId: string;
  /** Whose turn it actually is, recomputed server-side. */
  onClockTeamId: string | null;
  /** Phases that are finished take no more picks, from anyone. */
  phaseIsComplete: boolean;
}

export type PickRefusal =
  | "phase-complete"
  | "not-your-team"
  | "not-your-turn"
  | "no-claim";

export interface PickPermission {
  allowed: boolean;
  reason?: PickRefusal;
}

export function checkPickPermission(request: PickRequest): PickPermission {
  // A finished phase is closed to everyone, commissioner included. Undo
  // is the way back into one, not another pick.
  if (request.phaseIsComplete) {
    return { allowed: false, reason: "phase-complete" };
  }

  if (request.isCommissioner) return { allowed: true };

  if (!request.claimedTeamId) return { allowed: false, reason: "no-claim" };

  // Checked before the clock: telling someone "not your turn" about a
  // team that was never theirs would be a small, confusing lie.
  if (request.claimedTeamId !== request.forTeamId) {
    return { allowed: false, reason: "not-your-team" };
  }

  if (request.onClockTeamId !== request.forTeamId) {
    return { allowed: false, reason: "not-your-turn" };
  }

  return { allowed: true };
}

/** What to show someone who has been refused. */
export function refusalMessage(reason: PickRefusal): string {
  switch (reason) {
    case "phase-complete":
      return "This draft is finished.";
    case "not-your-team":
      return "That's not your team.";
    case "not-your-turn":
      return "It's not your turn yet.";
    case "no-claim":
      return "Claim a team first.";
  }
}
