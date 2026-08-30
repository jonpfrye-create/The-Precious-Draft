import { describe, expect, it } from "vitest";
import { formatAllRosters, formatTeamRoster } from "./roster-export";

const player = (
  full_name: string,
  position: string,
  nfl_team: string | null,
  round: number
) => ({ full_name, position, nfl_team, round });

describe("formatTeamRoster", () => {
  // Deliberately out of order in the array: the round column is what
  // decides the order, not the order the picks arrived in.
  const full = {
    teamName: "Prestige Worldwide - Larry",
    players: [
      player("T.J. Hockenson", "TE", "MIN", 6),
      player("Josh Allen", "QB", "BUF", 1),
      player("Jason Myers", "K", "SEA", 9),
      player("Bijan Robinson", "RB", "ATL", 2),
      player("Chase Brown", "RB", "CIN", 3),
      player("Ja'Marr Chase", "WR", "CIN", 4),
      player("DJ Moore", "WR", "CHI", 5),
      player("Jahmyr Gibbs", "RB", "DET", 7),
      player("Ravens", "DEF", "BAL", 8),
    ],
  };

  it("leads with the team name", () => {
    expect(formatTeamRoster(full).split("\n")[0]).toBe(
      "Prestige Worldwide - Larry"
    );
  });

  it("lists players in round order, whatever order they arrive in", () => {
    const names = formatTeamRoster(full)
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^\s*\d+\.\s+/, "").split(" (")[0]);
    expect(names).toEqual([
      "Josh Allen",
      "Bijan Robinson",
      "Chase Brown",
      "Ja'Marr Chase",
      "DJ Moore",
      "T.J. Hockenson",
      "Jahmyr Gibbs",
      "Ravens",
      "Jason Myers",
    ]);
  });

  it("numbers every line with its round", () => {
    const rounds = formatTeamRoster(full)
      .split("\n")
      .slice(1)
      .map((l) => Number(l.trim().split(".")[0]));
    expect(rounds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("includes the NFL team so names can be told apart", () => {
    expect(formatTeamRoster(full)).toContain("Josh Allen (BUF) QB");
  });

  it("includes the position, which is what Yahoo asks for next", () => {
    const line = formatTeamRoster(full)
      .split("\n")
      .find((l) => l.includes("Ravens"));
    expect(line).toContain("DEF");
  });

  it("handles a player with no NFL team", () => {
    const roster = {
      teamName: "Free Agents",
      players: [player("Unsigned Guy", "K", null, 1)],
    };
    const line = formatTeamRoster(roster)
      .split("\n")
      .find((l) => l.includes("Unsigned Guy"));
    expect(line).toContain("Unsigned Guy");
    expect(line).not.toContain("(");
  });

  it("right-aligns round numbers so the names form a column", () => {
    // Fourteen rounds means a one-digit and a two-digit column, which is
    // exactly where a left-aligned number would stagger the names.
    const long = {
      teamName: "Long Draft",
      players: [
        player("Round One", "QB", "BUF", 1),
        player("Round Ten", "RB", "ATL", 10),
        player("Round Fourteen", "K", "SEA", 14),
      ],
    };
    const starts = formatTeamRoster(long)
      .split("\n")
      .slice(1)
      .map((l) => l.indexOf("Round "));
    expect(new Set(starts).size).toBe(1);
  });

  it("says so rather than printing a bare name for a team with no picks", () => {
    const empty = { teamName: "Nobody", players: [] };
    expect(formatTeamRoster(empty)).toContain("(no picks)");
  });

  it("keeps a gap visible rather than renumbering around it", () => {
    // A released player leaves a hole. Silently sliding round 3 up into
    // round 2's place would misreport the draft.
    const gapped = {
      teamName: "Gapped",
      players: [
        player("First", "QB", "BUF", 1),
        player("Third", "RB", "ATL", 3),
      ],
    };
    const rounds = formatTeamRoster(gapped)
      .split("\n")
      .slice(1)
      .map((l) => Number(l.trim().split(".")[0]));
    expect(rounds).toEqual([1, 3]);
  });
});

describe("formatAllRosters", () => {
  const rosters = [
    { teamName: "Team A", players: [player("Josh Allen", "QB", "BUF", 1)] },
    { teamName: "Team B", players: [player("Jason Myers", "K", "SEA", 1)] },
  ];

  it("includes every team under one heading", () => {
    const text = formatAllRosters(rosters, "Leftovers rosters");
    expect(text).toContain("Leftovers rosters");
    expect(text).toContain("Team A");
    expect(text).toContain("Team B");
  });

  it("underlines the heading to the right width", () => {
    const [heading, rule] = formatAllRosters(
      rosters,
      "Leftovers rosters"
    ).split("\n");
    expect(rule).toHaveLength(heading.length);
  });

  it("separates teams with a blank line for pasting", () => {
    expect(formatAllRosters(rosters, "X")).toContain("\n\nTeam B");
  });
});
