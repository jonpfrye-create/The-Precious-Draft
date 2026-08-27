import { describe, expect, it } from "vitest";
import { DRAFT_START_MS } from "./draft-clock";
import {
  BEEP_INTERVAL_MS,
  CHAOS_LEVELS,
  LEVEL_NAMES,
  TENSION_WINDOW_MS,
  chaosLevel,
  tensionAt,
} from "./tension";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const before = (ms: number) => DRAFT_START_MS - ms;

describe("tensionAt", () => {
  it("is perfectly still outside the window", () => {
    expect(tensionAt(before(TENSION_WINDOW_MS), DRAFT_START_MS)).toBe(0);
    expect(tensionAt(before(TENSION_WINDOW_MS + DAY), DRAFT_START_MS)).toBe(0);
  });

  it("is at full tilt on the hour, and stays there", () => {
    expect(tensionAt(DRAFT_START_MS, DRAFT_START_MS)).toBe(1);
    expect(tensionAt(DRAFT_START_MS + HOUR, DRAFT_START_MS)).toBe(1);
  });

  it("only ever rises as the draft gets closer", () => {
    let last = -1;
    for (let d = 10; d >= 0; d -= 0.25) {
      const t = tensionAt(before(d * DAY), DRAFT_START_MS);
      expect(t, `${d} days out`).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });

  it("keeps almost all of the movement in the last day", () => {
    // The whole point of the curve. Three days out it should be barely
    // perceptible; a linear ramp would already be at 0.7 here.
    expect(tensionAt(before(3 * DAY), DRAFT_START_MS)).toBeLessThan(0.2);
    // The day before, clearly something is happening.
    expect(tensionAt(before(DAY), DRAFT_START_MS)).toBeGreaterThan(0.35);
    // The last hour is the loudest part by a distance.
    expect(tensionAt(before(HOUR), DRAFT_START_MS)).toBeGreaterThan(0.95);
  });

  it("never leaves 0..1", () => {
    for (const ms of [-DAY, 0, HOUR, DAY, 9 * DAY, 40 * DAY]) {
      const t = tensionAt(before(ms), DRAFT_START_MS);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});

describe("chaosLevel", () => {
  it("covers every gear and never goes out of range", () => {
    const seen = new Set<number>();
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const level = chaosLevel(t);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThan(CHAOS_LEVELS);
      seen.add(level);
    }
    expect(seen.size).toBe(CHAOS_LEVELS);
  });

  it("is still at rest and critical at the end", () => {
    expect(chaosLevel(0)).toBe(0);
    expect(chaosLevel(1)).toBe(CHAOS_LEVELS - 1);
  });

  it("never drops as tension rises", () => {
    let last = 0;
    for (let t = 0; t <= 1; t += 0.005) {
      const level = chaosLevel(t);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it("reaches the last gear before the final hour, not on it", () => {
    // If the loudest gear only arrived at 5pm exactly, nobody would ever
    // see it - the door opens at the same moment.
    expect(chaosLevel(tensionAt(before(HOUR), DRAFT_START_MS))).toBe(
      CHAOS_LEVELS - 1
    );
  });
});

describe("pacing", () => {
  // When each gear actually engages, in hours before the draft. These are
  // the numbers anyone would want to check when changing the curve, and
  // they are invisible in the curve itself - 0.62 says nothing about
  // Friday evening until you work it out.
  const arrivesAt = (level: number): number => {
    for (let h = 10 * 24; h >= 0; h--) {
      if (chaosLevel(tensionAt(before(h * HOUR), DRAFT_START_MS)) >= level) {
        return h;
      }
    }
    return 0;
  };

  it("starts stirring a few days out, not a week", () => {
    const h = arrivesAt(1);
    expect(h).toBeGreaterThan(48);
    expect(h).toBeLessThan(96);
  });

  it("is restless the evening before the evening before", () => {
    const h = arrivesAt(2);
    expect(h).toBeGreaterThan(24);
    expect(h).toBeLessThan(60);
  });

  it("is agitated by the night before", () => {
    const h = arrivesAt(3);
    expect(h).toBeGreaterThan(12);
    expect(h).toBeLessThan(30);
  });

  it("saves the top gear for the last couple of hours", () => {
    // It ran for seven hours once. Flat out all Saturday morning is
    // exhausting and wastes the loudest thing on the page.
    const h = arrivesAt(4);
    expect(h).toBeGreaterThanOrEqual(1);
    expect(h).toBeLessThanOrEqual(5);
  });

  it("engages every gear in order, none skipped", () => {
    for (let level = 1; level < CHAOS_LEVELS; level++) {
      expect(arrivesAt(level), `level ${level}`).toBeLessThan(
        arrivesAt(level - 1) || Infinity
      );
    }
  });
});

describe("level tables", () => {
  it("have an entry for every gear", () => {
    expect(LEVEL_NAMES).toHaveLength(CHAOS_LEVELS);
    expect(BEEP_INTERVAL_MS).toHaveLength(CHAOS_LEVELS);
  });

  it("are silent at rest and speed up from there", () => {
    expect(BEEP_INTERVAL_MS[0]).toBe(0);
    for (let i = 2; i < CHAOS_LEVELS; i++) {
      expect(BEEP_INTERVAL_MS[i]).toBeLessThan(BEEP_INTERVAL_MS[i - 1]);
    }
    // Never so fast it stops being tension and becomes an alarm.
    expect(BEEP_INTERVAL_MS[CHAOS_LEVELS - 1]).toBeGreaterThanOrEqual(1000);
  });
});
