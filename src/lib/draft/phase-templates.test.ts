import { describe, expect, it } from "vitest";
import {
  leftoversTemplate,
  microwaveTemplate,
  nextPhaseType,
  templateForPhase,
  type SlotTemplate,
} from "./phase-templates";

const FLEX = ["RB", "WR", "TE"];
const ANY = ["QB", "RB", "WR", "TE", "K", "DEF"];

// The real Main roster: no kicker, six bench slots.
const MAIN_SLOTS: SlotTemplate[] = [
  { slotName: "QB", eligiblePositions: ["QB"], isBench: false },
  { slotName: "RB1", eligiblePositions: ["RB"], isBench: false },
  { slotName: "RB2", eligiblePositions: ["RB"], isBench: false },
  { slotName: "WR1", eligiblePositions: ["WR"], isBench: false },
  { slotName: "WR2", eligiblePositions: ["WR"], isBench: false },
  { slotName: "TE", eligiblePositions: ["TE"], isBench: false },
  { slotName: "FLEX", eligiblePositions: FLEX, isBench: false },
  { slotName: "DEF", eligiblePositions: ["DEF"], isBench: false },
  ...Array.from({ length: 6 }, (_, i) => ({
    slotName: `BENCH ${i + 1}`,
    eligiblePositions: ANY,
    isBench: true,
  })),
];

describe("nextPhaseType", () => {
  it("walks main -> leftovers -> microwave", () => {
    expect(nextPhaseType("main")).toBe("leftovers");
    expect(nextPhaseType("leftovers")).toBe("microwave");
  });

  it("ends after microwave", () => {
    expect(nextPhaseType("microwave")).toBeNull();
  });
});

describe("leftoversTemplate", () => {
  it("produces nine slots from the real Main roster", () => {
    // The number the league expects: eight starters plus the kicker.
    expect(leftoversTemplate(MAIN_SLOTS)).toHaveLength(9);
  });

  it("drops every bench slot", () => {
    expect(
      leftoversTemplate(MAIN_SLOTS).every((slot) => !slot.isBench)
    ).toBe(true);
  });

  it("adds a kicker slot, since Main has none", () => {
    const names = leftoversTemplate(MAIN_SLOTS).map((s) => s.slotName);
    expect(names).toEqual([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "TE",
      "FLEX",
      "DEF",
      "K",
    ]);
  });

  it("does not add a second kicker if one is already there", () => {
    const withKicker: SlotTemplate[] = [
      ...MAIN_SLOTS,
      { slotName: "K", eligiblePositions: ["K"], isBench: false },
    ];
    const kickers = leftoversTemplate(withKicker).filter(
      (s) => s.eligiblePositions.length === 1 && s.eligiblePositions[0] === "K"
    );
    expect(kickers).toHaveLength(1);
  });

  it("keeps the starters' eligibility untouched", () => {
    const flex = leftoversTemplate(MAIN_SLOTS).find(
      (s) => s.slotName === "FLEX"
    );
    expect(flex?.eligiblePositions).toEqual(FLEX);
  });

  it("does not mutate the slots it was given", () => {
    const before = JSON.stringify(MAIN_SLOTS);
    leftoversTemplate(MAIN_SLOTS);
    expect(JSON.stringify(MAIN_SLOTS)).toBe(before);
  });

  it("follows Main if Main's shape changes in a future season", () => {
    const twoQbLeague: SlotTemplate[] = [
      { slotName: "QB1", eligiblePositions: ["QB"], isBench: false },
      { slotName: "QB2", eligiblePositions: ["QB"], isBench: false },
      { slotName: "BENCH 1", eligiblePositions: ANY, isBench: true },
    ];
    const result = leftoversTemplate(twoQbLeague);
    expect(result.map((s) => s.slotName)).toEqual(["QB1", "QB2", "K"]);
  });
});

describe("microwaveTemplate", () => {
  it("is exactly one flex starter and one bench slot", () => {
    const slots = microwaveTemplate();
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({
      slotName: "W/R/T",
      eligiblePositions: FLEX,
      isBench: false,
    });
    expect(slots[1].isBench).toBe(true);
  });

  it("allows only flex positions, bench included", () => {
    // No quarterbacks, kickers or defenses anywhere in Microwave.
    for (const slot of microwaveTemplate()) {
      expect(slot.eligiblePositions).toEqual(FLEX);
      for (const banned of ["QB", "K", "DEF"]) {
        expect(slot.eligiblePositions).not.toContain(banned);
      }
    }
  });

  it("ignores whatever came before it", () => {
    expect(templateForPhase("microwave", MAIN_SLOTS)).toHaveLength(2);
  });
});

describe("templateForPhase", () => {
  it("routes each phase to its own template", () => {
    expect(templateForPhase("leftovers", MAIN_SLOTS)).toHaveLength(9);
    expect(templateForPhase("microwave", MAIN_SLOTS)).toHaveLength(2);
  });
});
