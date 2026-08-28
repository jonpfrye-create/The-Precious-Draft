import { describe, expect, it } from "vitest";
import {
  altitudeForStep,
  climbScene,
  hazardOrder,
  HAZARDS,
  ordinal,
  stepForPosition,
  YETI,
  type ClimbTeam,
  type Felling,
} from "./climb";
import { isPositionRevealed } from "@/lib/draft/order-draw";

const SEED = "phase-abc";

const field = (n: number): ClimbTeam[] =>
  Array.from({ length: n }, (_, i) => ({
    teamId: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    hex: "#e8a33d",
  }));

const TEAMS = field(12);

/**
 * The drawn order, which only ever exists in this test file. Index 0
 * picks first.
 */
const ORDER = TEAMS.map((t) => t.teamId);

/** What the server would have sent after `revealed` presses. */
const fellingsAfter = (revealed: number, teams = TEAMS): Felling[] => {
  const n = teams.length;
  return teams
    .map((t, i) => ({ position: i + 1, teamId: t.teamId }))
    .filter((f) => isPositionRevealed(n, revealed, f.position));
};

describe("stepForPosition", () => {
  it("matches the reveal order the commissioner already presses through", () => {
    // order-draw.ts turns over the last position first and position 1
    // last. One press is one mascot felled, and this is the only place
    // that correspondence is written down.
    expect(stepForPosition(12, 12)).toBe(1);
    expect(stepForPosition(12, 1)).toBe(12);
  });
});

describe("climbScene", () => {
  it("puts everyone on the mountain before anything is revealed", () => {
    // The field is public - the waiting room lists all twelve names - so
    // every mascot is on screen from the gun. You can find yours.
    const scene = climbScene(TEAMS, [], SEED);
    expect(scene.climbers).toHaveLength(12);
    expect(scene.climbers.every((c) => c.status === "climbing")).toBe(true);
    expect(scene.packAltitude).toBe(0);
    expect(scene.latest).toBeNull();
    expect(scene.complete).toBe(false);
  });

  it("never carries a draft position that has not been turned over", () => {
    // The whole reason this takes teams and fellings separately. /draft
    // was shipping the entire order to twelve browsers a fortnight ago
    // because the service-role key bypasses the RLS that was supposed to
    // stop it; the fix is not sending it, and this is the assertion that
    // keeps it not sent.
    for (let revealed = 0; revealed <= 12; revealed++) {
      const scene = climbScene(TEAMS, fellingsAfter(revealed), SEED);

      const exposed = scene.climbers
        .filter((c) => c.position !== null)
        .map((c) => c.position!);
      expect(exposed).toHaveLength(revealed);

      for (const position of exposed) {
        expect(
          isPositionRevealed(12, revealed, position),
          `position ${position} at ${revealed} revealed`
        ).toBe(true);
      }

      // And nothing else on a climbing mascot hints at where it lands.
      for (const c of scene.climbers.filter((x) => x.status === "climbing")) {
        expect(c.step).toBeNull();
        expect(c.hazard).toBeNull();
      }
    }
  });

  it("fells one more mascot per press, in reveal order", () => {
    for (let revealed = 1; revealed <= 12; revealed++) {
      const scene = climbScene(TEAMS, fellingsAfter(revealed), SEED);
      const down = scene.climbers.filter((c) => c.status !== "climbing");
      expect(down).toHaveLength(revealed);
      // The k-th press accounts for the k-th from last pick.
      expect(scene.latest!.position).toBe(12 - revealed + 1);
      expect(scene.latest!.step).toBe(revealed);
    }
  });

  it("leaves whoever picks first stood on the summit", () => {
    const scene = climbScene(TEAMS, fellingsAfter(12), SEED);
    const first = scene.climbers.find((c) => c.position === 1)!;

    expect(first.teamId).toBe(ORDER[0]);
    expect(first.status).toBe("summited");
    expect(first.altitude).toBe(1);
    // Nothing got them, and they stand in the middle of the peak rather
    // than out in whichever lane they happened to climb.
    expect(first.hazard).toBeNull();
    expect(first.lane).toBe(0.5);

    expect(scene.complete).toBe(true);
    expect(scene.climbers.filter((c) => c.status === "summited")).toHaveLength(1);
  });

  it("climbs - the pack is higher after every press", () => {
    let previous = -1;
    for (let revealed = 0; revealed <= 12; revealed++) {
      const { packAltitude } = climbScene(TEAMS, fellingsAfter(revealed), SEED);
      expect(packAltitude).toBeGreaterThan(previous);
      previous = packAltitude;
    }
    expect(previous).toBe(1);
  });

  it("fells each mascot higher up than the last, at any field size", () => {
    // The fallen are meant to read as a trail up the mountain in the
    // order they went down, so the wobble that keeps the pack from
    // looking like a row of skittles is bounded by the gap between two
    // fellings rather than being a flat number that happened to be small
    // enough for twelve.
    for (const size of [2, 5, 12, 16, 40]) {
      const teams = field(size);
      const scene = climbScene(teams, fellingsAfter(size, teams), SEED);
      const bySteps = [...scene.climbers].sort((a, b) => a.step! - b.step!);
      for (let i = 1; i < bySteps.length; i++) {
        expect(
          bySteps[i].altitude,
          `${size} teams, step ${i + 1}`
        ).toBeGreaterThan(bySteps[i - 1].altitude);
      }
    }
  });

  it("keeps everyone on the mountain face", () => {
    const scene = climbScene(TEAMS, fellingsAfter(6), SEED);
    for (const c of scene.climbers) {
      expect(c.lane).toBeGreaterThanOrEqual(0);
      expect(c.lane).toBeLessThanOrEqual(1);
      expect(c.altitude).toBeGreaterThanOrEqual(0);
      expect(c.altitude).toBeLessThanOrEqual(1);
    }
  });

  it("does not depend on the order the fellings arrive in", () => {
    // They come off a database query. If a reordered array reshuffled
    // the disasters, two phones could show the same mascot killed by
    // different things.
    const forwards = fellingsAfter(7);
    const backwards = [...forwards].reverse();
    expect(climbScene(TEAMS, backwards, SEED)).toEqual(
      climbScene(TEAMS, forwards, SEED)
    );
  });

  it("is identical for the same seed and different for another", () => {
    const a = climbScene(TEAMS, fellingsAfter(5), SEED);
    expect(climbScene(TEAMS, fellingsAfter(5), SEED)).toEqual(a);
    expect(climbScene(TEAMS, fellingsAfter(5), "phase-xyz")).not.toEqual(a);
  });

  it("copes with a field that is not twelve", () => {
    // Leftovers and Microwave run with whoever stayed.
    for (const size of [1, 2, 5, 8, 16]) {
      const teams = field(size);
      const scene = climbScene(teams, fellingsAfter(size, teams), SEED);
      expect(scene.climbers, `${size}`).toHaveLength(size);
      expect(
        scene.climbers.filter((c) => c.status === "summited"),
        `${size}`
      ).toHaveLength(1);
      expect(scene.complete, `${size}`).toBe(true);
    }
  });

  it("survives an empty field without inventing a summit", () => {
    const scene = climbScene([], [], SEED);
    expect(scene.climbers).toHaveLength(0);
    expect(scene.complete).toBe(false);
    expect(scene.latest).toBeNull();
  });
});

describe("hazards", () => {
  it("spends the yeti on the last felling before the summit", () => {
    // The near miss: one place short of the first pick, eaten instead.
    const scene = climbScene(TEAMS, fellingsAfter(12), SEED);
    const runnerUp = scene.climbers.find((c) => c.position === 2)!;
    expect(runnerUp.hazard).toEqual(YETI);

    // And nowhere else - it is only worth anything used once.
    expect(scene.climbers.filter((c) => c.hazard?.id === "yeti")).toHaveLength(1);
  });

  it("never kills two in a row the same way", () => {
    for (const seed of [SEED, "a", "b", "2026-08-29"]) {
      const scene = climbScene(TEAMS, fellingsAfter(12), seed);
      const inOrder = [...scene.climbers]
        .sort((a, b) => a.step! - b.step!)
        .map((c) => c.hazard?.id ?? "summit");
      for (let i = 1; i < inOrder.length; i++) {
        expect(inOrder[i], `${seed} step ${i + 1}`).not.toBe(inOrder[i - 1]);
      }
    }
  });

  it("gets through the whole catalogue over a twelve-team climb", () => {
    const scene = climbScene(TEAMS, fellingsAfter(12), SEED);
    const seen = new Set(scene.climbers.map((c) => c.hazard?.id));
    for (const hazard of HAZARDS) {
      expect(seen.has(hazard.id), hazard.id).toBe(true);
    }
  });

  it("shuffles the disasters per league but keeps all of them", () => {
    const order = hazardOrder(SEED);
    expect(order).toHaveLength(HAZARDS.length);
    expect(new Set(order.map((h) => h.id)).size).toBe(HAZARDS.length);
    expect(hazardOrder("other")).not.toEqual(order);
  });
});

describe("altitudeForStep", () => {
  it("tops out at the summit and never overshoots", () => {
    expect(altitudeForStep(12, 12)).toBe(1);
    expect(altitudeForStep(12, 99)).toBe(1);
    expect(altitudeForStep(12, 0)).toBe(0);
    expect(altitudeForStep(0, 3)).toBe(0);
  });
});

describe("ordinal", () => {
  it("reads the way the room says it", () => {
    expect(ordinal(1)).toBe("1ST");
    expect(ordinal(2)).toBe("2ND");
    expect(ordinal(3)).toBe("3RD");
    expect(ordinal(4)).toBe("4TH");
    expect(ordinal(11)).toBe("11TH");
    expect(ordinal(12)).toBe("12TH");
    expect(ordinal(13)).toBe("13TH");
  });
});
