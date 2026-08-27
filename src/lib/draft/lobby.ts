/**
 * What the waiting room should be showing, and who belongs in it.
 *
 * Between "the door opened at five" and "we are drafting" there are three
 * things the ten people who aren't in the room need to see, in order: who
 * has turned up, the order turning over a pick at a time, and then the
 * draft.
 *
 * The gate is the *reveal*, not the phase's status. A phase is created
 * `active` the moment the commissioner finishes setup (see
 * commish/setup/actions.ts), so status says nothing about whether the
 * league is ready to draft - gating on it would have marched everyone
 * past the waiting room and into a board showing the placeholder order.
 * What actually separates "before" from "during" is whether the order has
 * been drawn and turned over. Finishing the reveal is what starts the
 * draft; there is no separate button, and nothing new to remember to
 * press on the night.
 *
 * Kept pure and away from the page so the transitions can be tested, and
 * shared with /draft so the two can't disagree about who belongs where -
 * a disagreement there is either a redirect loop or a leak.
 */

export type LobbyPhase = {
  status: string;
  orderDrawnAt: string | null;
  revealedCount: number;
};

export type LobbyState =
  /** Drafting, or done. Nobody belongs in the lobby. */
  | { kind: "drafting" }
  /** Order drawn; positions are turning over. */
  | { kind: "revealing"; revealedCount: number; complete: boolean }
  /** Waiting on the league to arrive, and then on the commissioner. */
  | { kind: "waiting"; everyoneIn: boolean };

export function lobbyState(
  phase: LobbyPhase | null,
  teamCount: number,
  claimedCount: number,
  picksMade: number
): LobbyState {
  // No phase at all - nothing set up yet. Waiting rather than an error,
  // because this is what a league looks like for the few minutes before
  // the commissioner configures Main.
  if (!phase) return { kind: "waiting", everyoneIn: false };

  // A finished phase has a board worth looking at, and a phase with picks
  // in it is unambiguously under way. This second test is also what keeps
  // every draft that predates the reveal working: those have
  // order_revealed_count sitting at 0 forever, and without it their
  // drafters would be herded into a waiting room mid-draft.
  if (phase.status === "completed") return { kind: "drafting" };
  if (picksMade > 0) return { kind: "drafting" };

  // Still on the placeholder order typed in at setup.
  if (phase.orderDrawnAt === null) {
    return {
      kind: "waiting",
      everyoneIn: claimedCount >= teamCount && teamCount > 0,
    };
  }

  return {
    kind: "revealing",
    revealedCount: phase.revealedCount,
    complete: teamCount > 0 && phase.revealedCount >= teamCount,
  };
}

/**
 * Whether this person should be in the lobby rather than on /draft.
 *
 * /draft reads through the service-role key, which bypasses RLS, so the
 * reveal gating in supabase/003-order-reveal.sql does nothing to protect
 * it. Anyone who lands there before the reveal has finished gets the
 * whole order rendered into their page.
 */
export function belongsInLobby(
  phase: LobbyPhase | null,
  teamCount: number,
  picksMade: number
): boolean {
  const state = lobbyState(phase, teamCount, teamCount, picksMade);
  if (state.kind === "drafting") return false;
  // A finished reveal is the one state the two pages must read
  // differently. The lobby keeps showing it - it holds the completed
  // order on screen while the confetti lands, then sends everyone on -
  // but /draft has to let them in when they arrive. Treating "complete"
  // as still-belongs-in-the-lobby bounces them straight back and the two
  // pages ping-pong forever.
  if (state.kind === "revealing") return !state.complete;
  return true;
}
