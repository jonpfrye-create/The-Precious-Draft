import { describe, expect, it } from "vitest";
import { belongsInLobby, lobbyState, type LobbyPhase } from "./lobby";

// A phase as the commissioner's own setup leaves it: active from the
// moment it exists, on the placeholder order, nothing drawn.
const fresh = (over: Partial<LobbyPhase> = {}): LobbyPhase => ({
  status: "active",
  orderDrawnAt: null,
  revealedCount: 0,
  ...over,
});

const DRAWN = "2026-08-29T00:05:00Z";

describe("lobbyState", () => {
  it("waits while the league is still arriving", () => {
    expect(lobbyState(fresh(), 12, 7, 0)).toEqual({
      kind: "waiting",
      everyoneIn: false,
    });
  });

  it("knows when everyone is in but the order isn't drawn", () => {
    expect(lobbyState(fresh(), 12, 12, 0)).toEqual({
      kind: "waiting",
      everyoneIn: true,
    });
  });

  it("does not treat an active phase as a started draft", () => {
    // The trap this whole module exists for. Setup creates the Main phase
    // `active` immediately, so status cannot be the gate - reading it as
    // one sends twelve people past the waiting room and into a board
    // showing the placeholder order.
    expect(lobbyState(fresh(), 12, 12, 0).kind).toBe("waiting");
    expect(belongsInLobby(fresh(), 12, 0)).toBe(true);
  });

  it("waits when there is no phase yet", () => {
    expect(lobbyState(null, 12, 0, 0)).toEqual({
      kind: "waiting",
      everyoneIn: false,
    });
  });

  it("never announces a full house to an empty league", () => {
    expect(lobbyState(fresh(), 0, 0, 0)).toEqual({
      kind: "waiting",
      everyoneIn: false,
    });
  });

  it("switches to the reveal once the order is drawn", () => {
    expect(lobbyState(fresh({ orderDrawnAt: DRAWN }), 12, 12, 0)).toEqual({
      kind: "revealing",
      revealedCount: 0,
      complete: false,
    });
  });

  it("counts the reveal up and knows when it has finished", () => {
    expect(
      lobbyState(fresh({ orderDrawnAt: DRAWN, revealedCount: 5 }), 12, 12, 0)
    ).toMatchObject({ revealedCount: 5, complete: false });

    expect(
      lobbyState(fresh({ orderDrawnAt: DRAWN, revealedCount: 12 }), 12, 12, 0)
    ).toMatchObject({ kind: "revealing", complete: true });
  });

  it("lets the first pick settle it, whatever the reveal says", () => {
    // Every draft run before the reveal existed has revealedCount stuck
    // at 0. Without this those drafters would be herded into a waiting
    // room in the middle of their own draft.
    expect(
      lobbyState(fresh({ orderDrawnAt: DRAWN, revealedCount: 0 }), 12, 12, 1)
    ).toEqual({ kind: "drafting" });
    expect(belongsInLobby(fresh({ revealedCount: 0 }), 12, 30)).toBe(false);
  });

  it("sends people to the board once a phase is completed", () => {
    expect(
      lobbyState(fresh({ status: "completed", orderDrawnAt: DRAWN }), 12, 12, 0)
    ).toEqual({ kind: "drafting" });
  });
});

describe("belongsInLobby", () => {
  it("never bounces both ways at once", () => {
    // The property that matters. /draft sends you to /lobby when
    // belongsInLobby says so; /lobby sends you to /draft when it has
    // nothing left to show. If both are ever true for the same state the
    // two pages ping-pong and the phone is unusable - which is exactly
    // what happened when a finished reveal counted as still belonging in
    // the lobby.
    const cases: [LobbyPhase | null, number, number][] = [
      [null, 12, 0],
      [fresh(), 12, 0],
      [fresh({ orderDrawnAt: DRAWN }), 12, 0],
      [fresh({ orderDrawnAt: DRAWN, revealedCount: 1 }), 12, 0],
      [fresh({ orderDrawnAt: DRAWN, revealedCount: 11 }), 12, 0],
      [fresh({ orderDrawnAt: DRAWN, revealedCount: 12 }), 12, 0],
      [fresh({ orderDrawnAt: DRAWN, revealedCount: 12 }), 12, 4],
      [fresh({ orderDrawnAt: DRAWN, revealedCount: 0 }), 12, 30],
      [fresh({ status: "completed" }), 12, 0],
      [fresh(), 0, 0],
    ];

    for (const [phase, teams, picks] of cases) {
      const draftSendsAway = belongsInLobby(phase, teams, picks);
      const lobbySendsAway =
        lobbyState(phase, teams, teams, picks).kind === "drafting";
      expect(
        draftSendsAway && lobbySendsAway,
        `loop at ${JSON.stringify({ phase, teams, picks })}`
      ).toBe(false);
    }
  });

  it("holds people until the very last position turns over", () => {
    expect(
      belongsInLobby(fresh({ orderDrawnAt: DRAWN, revealedCount: 11 }), 12, 0)
    ).toBe(true);
    // Complete: /draft must let them in, because the lobby is about to
    // send them there itself.
    expect(
      belongsInLobby(fresh({ orderDrawnAt: DRAWN, revealedCount: 12 }), 12, 0)
    ).toBe(false);
  });
});
