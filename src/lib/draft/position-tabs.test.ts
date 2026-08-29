import { describe, expect, it } from "vitest";
import {
  ALL_TAB,
  FLEX_TAB,
  defaultTab,
  matchesTab,
  positionTabs,
} from "./position-tabs";
import type { SlotSpec } from "./roster-fit";

function starter(slotName: string, eligiblePositions: string[]): SlotSpec {
  return { slotName, eligiblePositions, isBench: false };
}

function bench(slotName: string): SlotSpec {
  return {
    slotName,
    eligiblePositions: ["QB", "RB", "WR", "TE", "K", "DEF"],
    isBench: true,
  };
}

// The three real phases, exactly as they sit in the database for The
// Precious. If these drift the tabs are wrong on the night, so they are
// written out in full rather than built from a helper.
const MAIN: SlotSpec[] = [
  starter("QB", ["QB"]),
  starter("RB1", ["RB"]),
  starter("RB2", ["RB"]),
  starter("WR1", ["WR"]),
  starter("WR2", ["WR"]),
  starter("TE", ["TE"]),
  starter("FLEX", ["RB", "WR", "TE"]),
  starter("DEF", ["DEF"]),
  ...Array.from({ length: 6 }, (_, i) => bench(`BENCH ${i + 1}`)),
];

const LEFTOVERS: SlotSpec[] = [
  starter("QB", ["QB"]),
  starter("RB1", ["RB"]),
  starter("RB2", ["RB"]),
  starter("WR1", ["WR"]),
  starter("WR2", ["WR"]),
  starter("TE", ["TE"]),
  starter("FLEX", ["RB", "WR", "TE"]),
  starter("DEF", ["DEF"]),
  starter("K", ["K"]),
];

const MICROWAVE: SlotSpec[] = [
  starter("W/R/T", ["RB", "WR", "TE"]),
  { slotName: "BENCH", eligiblePositions: ["RB", "WR", "TE"], isBench: true },
];

describe("positionTabs", () => {
  it("gives Main no kicker tab, because Main has no kicker slot to start", () => {
    expect(positionTabs(MAIN)).not.toContain("K");
  });

  it("gives Leftovers a kicker tab, because Leftovers starts one", () => {
    expect(positionTabs(LEFTOVERS)).toContain("K");
  });

  it("restricts Microwave to the three positions it drafts", () => {
    expect(positionTabs(MICROWAVE)).toEqual([ALL_TAB, "RB", "WR", "TE", FLEX_TAB]);
  });

  it("opens every phase on All", () => {
    for (const slots of [MAIN, LEFTOVERS, MICROWAVE]) {
      expect(positionTabs(slots)[0]).toBe(ALL_TAB);
      expect(defaultTab(positionTabs(slots))).toBe(ALL_TAB);
    }
  });

  it("offers the flex group in all three phases", () => {
    for (const slots of [MAIN, LEFTOVERS, MICROWAVE]) {
      expect(positionTabs(slots)).toContain(FLEX_TAB);
    }
  });

  it("puts the flex group directly after TE", () => {
    const tabs = positionTabs(MAIN);
    expect(tabs[tabs.indexOf(FLEX_TAB) - 1]).toBe("TE");
  });

  it("keeps positions in the league's reading order", () => {
    expect(positionTabs(MAIN)).toEqual([
      ALL_TAB,
      "QB",
      "RB",
      "WR",
      "TE",
      FLEX_TAB,
      "DEF",
    ]);
  });

  it("ignores bench slots, which accept everything and would say nothing", () => {
    // A phase that starts one quarterback and benches anyone. Counting
    // the bench would put all six positions on screen.
    const slots = [starter("QB", ["QB"]), bench("BENCH 1")];
    expect(positionTabs(slots)).toEqual([ALL_TAB, "QB"]);
  });

  it("drops the flex group when only one of its positions can start", () => {
    const slots = [starter("RB1", ["RB"]), starter("RB2", ["RB"])];
    expect(positionTabs(slots)).toEqual([ALL_TAB, "RB"]);
  });

  it("still groups flex when the phase has no TE slot", () => {
    const slots = [starter("RB1", ["RB"]), starter("WR1", ["WR"])];
    expect(positionTabs(slots)).toEqual([ALL_TAB, "RB", "WR", FLEX_TAB]);
  });

  it("handles a phase with no slots at all", () => {
    expect(positionTabs([])).toEqual([ALL_TAB]);
  });
});

describe("matchesTab", () => {
  it("lets everything through All", () => {
    for (const position of ["QB", "RB", "WR", "TE", "K", "DEF", null]) {
      expect(matchesTab(ALL_TAB, position)).toBe(true);
    }
  });

  it("matches a single position exactly", () => {
    expect(matchesTab("RB", "RB")).toBe(true);
    expect(matchesTab("RB", "WR")).toBe(false);
  });

  it("takes the three flex positions and nothing else", () => {
    expect(matchesTab(FLEX_TAB, "RB")).toBe(true);
    expect(matchesTab(FLEX_TAB, "WR")).toBe(true);
    expect(matchesTab(FLEX_TAB, "TE")).toBe(true);
    expect(matchesTab(FLEX_TAB, "QB")).toBe(false);
    expect(matchesTab(FLEX_TAB, "K")).toBe(false);
    expect(matchesTab(FLEX_TAB, "DEF")).toBe(false);
  });

  it("does not put a player with no position under a position tab", () => {
    expect(matchesTab("RB", null)).toBe(false);
    expect(matchesTab(FLEX_TAB, null)).toBe(false);
  });
});
