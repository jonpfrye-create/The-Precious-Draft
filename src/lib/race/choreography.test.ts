import { describe, expect, it } from "vitest";
import { buildLanes, raceAt, raceLength } from "./choreography";

const TEAMS = Array.from({ length: 12 }, (_, i) => `team-${i + 1}`);
const SEED = "phase-abc";

const lanes = buildLanes(TEAMS, SEED);
const finishOrderOf = (t: number) =>
  [...raceAt(lanes, t)]
    .sort((a, b) => a.place - b.place)
    .map((r) => r.teamId);

describe("buildLanes", () => {
  it("gives every team a lane, in the order they were drawn", () => {
    expect(lanes).toHaveLength(TEAMS.length);
    expect(lanes.map((l) => l.teamId)).toEqual(TEAMS);
    expect(lanes.map((l) => l.finishRank)).toEqual(TEAMS.map((_, i) => i));
  });

  it("is identical for the same seed, and different for another", () => {
    // Twelve phones and a television have to watch the same race. A
    // runner leading on the TV and trailing on your phone is worse than
    // no race at all.
    expect(buildLanes(TEAMS, SEED)).toEqual(lanes);
    expect(buildLanes(TEAMS, "phase-xyz")).not.toEqual(lanes);
  });

  it("keeps the field close enough to stay worth watching", () => {
    const last = raceLength(lanes);
    expect(last).toBeGreaterThan(1);
    expect(last).toBeLessThan(1.25);
  });
});

describe("raceAt", () => {
  it("starts everyone on the line", () => {
    for (const runner of raceAt(lanes, 0)) {
      expect(runner.distance).toBe(0);
    }
  });

  it("finishes in exactly the order that was drawn", () => {
    // The whole contract. The order came off the server's shuffle and was
    // sealed before a frame was drawn; the race is not allowed to
    // disagree with it.
    expect(finishOrderOf(raceLength(lanes))).toEqual(TEAMS);
  });

  it("gets everyone over the line by the end", () => {
    for (const runner of raceAt(lanes, raceLength(lanes))) {
      expect(runner.distance, runner.teamId).toBe(1);
    }
  });

  it("has the winner break the tape first, and alone", () => {
    const atTape = raceAt(lanes, 1);
    const winner = atTape.find((r) => r.finishRank === 0);
    expect(winner!.distance).toBe(1);
    expect(atTape.filter((r) => r.distance >= 1)).toHaveLength(1);
  });

  it("never lets anyone run backwards or leave the track", () => {
    let previous = raceAt(lanes, 0);
    for (let t = 0.02; t <= raceLength(lanes); t += 0.02) {
      const now = raceAt(lanes, t);
      for (let i = 0; i < now.length; i++) {
        expect(now[i].distance).toBeGreaterThanOrEqual(0);
        expect(now[i].distance).toBeLessThanOrEqual(1);
      }
      previous = now;
    }
    expect(previous).toHaveLength(TEAMS.length);
  });

  it("actually has a race in it", () => {
    // If the eventual winner led from the gun to the tape it would be a
    // procession, and there would be no reason to watch. Somebody else
    // has to lead at some point.
    const leaders = new Set<string>();
    for (let t = 0.05; t < 0.9; t += 0.05) {
      leaders.add(finishOrderOf(t)[0]);
    }
    expect(leaders.size).toBeGreaterThan(1);
  });

  it("settles the placings before the tape rather than at it", () => {
    // The surges are damped as the line approaches, so the last stretch
    // is a run-in and not a lottery.
    const nearEnd = finishOrderOf(raceLength(lanes) * 0.97);
    expect(nearEnd).toEqual(TEAMS);
  });

  it("always ends correctly, whatever the seed", () => {
    for (const seed of ["a", "b", "phase-1", "zzz", "2026-08-29"]) {
      const other = buildLanes(TEAMS, seed);
      const finished = [...raceAt(other, raceLength(other))]
        .sort((a, b) => a.place - b.place)
        .map((r) => r.teamId);
      expect(finished, seed).toEqual(TEAMS);
    }
  });

  it("copes with a field that is not twelve", () => {
    // Leftovers and Microwave run with whoever stayed.
    for (const size of [1, 2, 5, 8, 16]) {
      const field = Array.from({ length: size }, (_, i) => `t${i}`);
      const l = buildLanes(field, "s");
      const finished = [...raceAt(l, raceLength(l))]
        .sort((a, b) => a.place - b.place)
        .map((r) => r.teamId);
      expect(finished, `${size} runners`).toEqual(field);
    }
  });
});
