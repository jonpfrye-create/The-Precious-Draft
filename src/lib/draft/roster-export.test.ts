import { describe, expect, it } from "vitest";
import { formatAllRosters, formatTeamRoster } from "./roster-export";
import type { SlotSpec } from "./roster-fit";

const LEFTOVERS: SlotSpec[] = [
  { slotName: "QB", eligiblePositions: ["QB"] },
  { slotName: "RB1", eligiblePositions: ["RB"] },
  { slotName: "RB2", eligiblePositions: ["RB"] },
  { slotName: "WR1", eligiblePositions: ["WR"] },
  { slotName: "WR2", eligiblePositions: ["WR"] },
  { slotName: "TE", eligiblePositions: ["TE"] },
  { slotName: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { slotName: "DEF", eligiblePositions: ["DEF"] },
  { slotName: "K", eligiblePositions: ["K"] },
];

const player = (full_name: string, position: string, nfl_team = "SEA") => ({
  full_name,
  position,
  nfl_team,
});

describe("formatTeamRoster", () => {
  const full = {
    teamName: "Prestige Worldwide - Larry",
    players: [
      player("Josh Allen", "QB", "BUF"),
      player("Bijan Robinson", "RB", "ATL"),
      player("Chase Brown", "RB", "CIN"),
      player("Ja'Marr Chase", "WR", "CIN"),
      player("DJ Moore", "WR", "CHI"),
      player("T.J. Hockenson", "TE", "MIN"),
      player("Jahmyr Gibbs", "RB", "DET"),
      player("Ravens", "DEF", "BAL"),
      player("Jason Myers", "K", "SEA"),
    ],
  };

  it("leads with the team name", () => {
    expect(formatTeamRoster(full, LEFTOVERS).split("\n")[0]).toBe(
      "Prestige Worldwide - Larry"
    );
  });

  it("lists slots in roster order, not pick order", () => {
    const lines = formatTeamRoster(full, LEFTOVERS).split("\n").slice(1);
    const labels = lines.map((l) => l.trim().split(/\s{2,}/)[0]);
    expect(labels).toEqual(LEFTOVERS.map((s) => s.slotName));
  });

  it("includes the NFL team so names can be told apart", () => {
    expect(formatTeamRoster(full, LEFTOVERS)).toContain("Josh Allen (BUF)");
  });

  it("puts the kicker on the K line", () => {
    const kLine = formatTeamRoster(full, LEFTOVERS)
      .split("\n")
      .find((l) => l.trim().startsWith("K "));
    expect(kLine).toContain("Jason Myers");
  });

  it("marks an unfilled slot rather than omitting it", () => {
    const partial = {
      teamName: "Half Team",
      players: [player("Josh Allen", "QB", "BUF")],
    };
    const lines = formatTeamRoster(partial, LEFTOVERS).split("\n");
    // Every slot still appears, so nothing looks accidentally missing.
    expect(lines).toHaveLength(1 + LEFTOVERS.length);
    expect(formatTeamRoster(partial, LEFTOVERS)).toContain("-");
  });

  it("flags a player who fits nowhere instead of dropping them", () => {
    const illegal = {
      teamName: "Two Kickers",
      players: [player("K One", "K"), player("K Two", "K")],
    };
    expect(formatTeamRoster(illegal, LEFTOVERS)).toContain("no slot for:");
  });

  it("handles a player with no NFL team", () => {
    const roster = {
      teamName: "Free Agents",
      players: [
        { full_name: "Unsigned Guy", position: "K", nfl_team: null },
      ],
    };
    const line = formatTeamRoster(roster, LEFTOVERS)
      .split("\n")
      .find((l) => l.includes("Unsigned Guy"));
    expect(line).toContain("Unsigned Guy");
    expect(line).not.toContain("(");
  });

  it("aligns slot labels so the list reads as a column", () => {
    const lines = formatTeamRoster(full, LEFTOVERS).split("\n").slice(1);
    const nameStarts = lines.map((l) => l.indexOf(l.trim().split(/\s{2,}/)[1]));
    expect(new Set(nameStarts).size).toBe(1);
  });
});

describe("formatAllRosters", () => {
  const rosters = [
    { teamName: "Team A", players: [player("Josh Allen", "QB", "BUF")] },
    { teamName: "Team B", players: [player("Jason Myers", "K", "SEA")] },
  ];

  it("includes every team under one heading", () => {
    const text = formatAllRosters(rosters, LEFTOVERS, "Leftovers rosters");
    expect(text).toContain("Leftovers rosters");
    expect(text).toContain("Team A");
    expect(text).toContain("Team B");
  });

  it("underlines the heading to the right width", () => {
    const [heading, rule] = formatAllRosters(
      rosters,
      LEFTOVERS,
      "Leftovers rosters"
    ).split("\n");
    expect(rule).toHaveLength(heading.length);
  });

  it("separates teams with a blank line for pasting", () => {
    expect(
      formatAllRosters(rosters, LEFTOVERS, "X")
    ).toContain("\n\nTeam B");
  });
});
