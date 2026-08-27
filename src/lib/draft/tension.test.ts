import { describe, expect, it } from "vitest";
import { DRAFT_START_MS } from "./draft-clock";
import {
  BEEP_INTERVAL_MS,
  CHAOS_LEVELS,
  GEAR_MINUTES_OUT,
  LEVEL_NAMES,
  chaosLevelAt,
  pitchForLevel,
} from "./tension";

const MINUTE = 60_000;
const at = (minutesOut: number) => DRAFT_START_MS - minutesOut * MINUTE;
const levelAt = (minutesOut: number) => chaosLevelAt(at(minutesOut), DRAFT_START_MS);

describe("chaosLevelAt", () => {
  it("engages each gear at the minute it is meant to", () => {
    // The whole schedule, written as the clock times the league will
    // actually see. 5:00 PM is the draft.
    expect(levelAt(5 * 24 * 60), "five days out").toBe(0);
    expect(levelAt(3 * 24 * 60), "three days out").toBe(1);
    expect(levelAt(60), "4:00 PM").toBe(1);
    expect(levelAt(31), "4:29 PM").toBe(1);
    expect(levelAt(30), "4:30 PM").toBe(2);
    expect(levelAt(11), "4:49 PM").toBe(2);
    expect(levelAt(10), "4:50 PM").toBe(3);
    expect(levelAt(3), "4:57 PM").toBe(3);
    expect(levelAt(2), "4:58 PM").toBe(4);
    expect(levelAt(0), "5:00 PM").toBe(4);
  });

  it("stays in the top gear once the draft has started", () => {
    expect(levelAt(-1)).toBe(CHAOS_LEVELS - 1);
    expect(levelAt(-600)).toBe(CHAOS_LEVELS - 1);
  });

  it("never drops as the draft gets closer", () => {
    let last = 0;
    for (let m = 6 * 24 * 60; m >= -30; m--) {
      const level = levelAt(m);
      expect(level, `${m} minutes out`).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it("reaches every gear, skipping none", () => {
    const seen = new Set<number>();
    for (let m = 6 * 24 * 60; m >= 0; m--) seen.add(levelAt(m));
    expect(seen.size).toBe(CHAOS_LEVELS);
  });

  it("keeps the loud gears short", () => {
    // An earlier version ran flat out from ten on Saturday morning -
    // seven hours, which is exhausting and spends the loudest thing on
    // the page long before anyone is watching.
    expect(GEAR_MINUTES_OUT[CHAOS_LEVELS - 1]).toBeLessThanOrEqual(5);
    expect(GEAR_MINUTES_OUT[2]).toBeLessThanOrEqual(60);
  });

  it("engages the gears in order", () => {
    for (let i = 1; i < GEAR_MINUTES_OUT.length; i++) {
      expect(GEAR_MINUTES_OUT[i], `gear ${i}`).toBeLessThan(
        GEAR_MINUTES_OUT[i - 1]
      );
    }
  });
});

describe("level tables", () => {
  it("have an entry for every gear", () => {
    expect(LEVEL_NAMES).toHaveLength(CHAOS_LEVELS);
    expect(BEEP_INTERVAL_MS).toHaveLength(CHAOS_LEVELS);
  });

  it("stays silent until the last half hour, then speeds up", () => {
    // Beeping at somebody for three days is not tension.
    expect(BEEP_INTERVAL_MS[0]).toBe(0);
    expect(BEEP_INTERVAL_MS[1]).toBe(0);
    for (let i = 3; i < CHAOS_LEVELS; i++) {
      expect(BEEP_INTERVAL_MS[i]).toBeLessThan(BEEP_INTERVAL_MS[i - 1]);
    }
    // Never so fast it stops being tension and becomes an alarm.
    expect(BEEP_INTERVAL_MS[CHAOS_LEVELS - 1]).toBeGreaterThanOrEqual(500);
  });

  it("the first audible gear is the one that starts the run-in", () => {
    const firstAudible = BEEP_INTERVAL_MS.findIndex((ms) => ms > 0);
    expect(GEAR_MINUTES_OUT[firstAudible]).toBe(30);
  });
});

describe("pitchForLevel", () => {
  it("spans 0 to 1 across the gears", () => {
    expect(pitchForLevel(0)).toBe(0);
    expect(pitchForLevel(CHAOS_LEVELS - 1)).toBe(1);
  });

  it("rises with the gear", () => {
    for (let i = 1; i < CHAOS_LEVELS; i++) {
      expect(pitchForLevel(i)).toBeGreaterThan(pitchForLevel(i - 1));
    }
  });
});
