import { describe, expect, it } from "vitest";
import {
  availablePlayersForPhase,
  excludedPlayerIds,
  type PhasePicks,
} from "./pool-exclusion";

const MAIN = 1;
const LEFTOVERS = 2;
const MICROWAVE = 3;

describe("excludedPlayerIds", () => {
  it("excludes nothing for the first phase (nothing has a lower sequence)", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1", "p2"] },
    ];
    expect(excludedPlayerIds(priorPhasePicks, MAIN)).toEqual(new Set());
  });

  it("Leftovers excludes only Main's picks", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1", "p2"] },
    ];
    expect(excludedPlayerIds(priorPhasePicks, LEFTOVERS)).toEqual(
      new Set(["p1", "p2"])
    );
  });

  it("Microwave excludes both Main's and Leftovers' picks", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1", "p2"] },
      { sequence: LEFTOVERS, playerIds: ["p3"] },
    ];
    expect(excludedPlayerIds(priorPhasePicks, MICROWAVE)).toEqual(
      new Set(["p1", "p2", "p3"])
    );
  });

  it("ignores phases with an equal or higher sequence than the target", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: LEFTOVERS, playerIds: ["p3"] },
      { sequence: MICROWAVE, playerIds: ["p4"] },
    ];
    expect(excludedPlayerIds(priorPhasePicks, LEFTOVERS)).toEqual(new Set());
  });
});

describe("availablePlayersForPhase", () => {
  const players = [
    { player_id: "p1", name: "Player One" },
    { player_id: "p2", name: "Player Two" },
    { player_id: "p3", name: "Player Three" },
    { player_id: "p4", name: "Player Four" },
  ];

  it("returns the full pool for Main when nothing has been drafted", () => {
    const result = availablePlayersForPhase(players, [], MAIN);
    expect(result).toEqual(players);
  });

  it("removes Main's picks from the Leftovers pool", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1"] },
    ];
    const result = availablePlayersForPhase(players, priorPhasePicks, LEFTOVERS);
    expect(result.map((p) => p.player_id)).toEqual(["p2", "p3", "p4"]);
  });

  it("removes Main's and Leftovers' picks from the Microwave pool", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1"] },
      { sequence: LEFTOVERS, playerIds: ["p2"] },
    ];
    const result = availablePlayersForPhase(players, priorPhasePicks, MICROWAVE);
    expect(result.map((p) => p.player_id)).toEqual(["p3", "p4"]);
  });

  it("also removes players already picked earlier in the current phase", () => {
    const result = availablePlayersForPhase(players, [], MAIN, ["p2", "p4"]);
    expect(result.map((p) => p.player_id)).toEqual(["p1", "p3"]);
  });

  it("composes cross-phase and in-phase exclusion together", () => {
    const priorPhasePicks: PhasePicks[] = [
      { sequence: MAIN, playerIds: ["p1"] },
    ];
    const result = availablePlayersForPhase(
      players,
      priorPhasePicks,
      LEFTOVERS,
      ["p2"]
    );
    expect(result.map((p) => p.player_id)).toEqual(["p3", "p4"]);
  });
});
