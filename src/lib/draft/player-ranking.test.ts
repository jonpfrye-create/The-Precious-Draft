import { describe, expect, it } from "vitest";
import { sortByDraftability, type RankablePlayer } from "./player-ranking";

function player(
  full_name: string,
  overrides: Partial<RankablePlayer> = {}
): RankablePlayer {
  return {
    full_name,
    position: "K",
    nfl_team: "SEA",
    search_rank: 999,
    status: "Active",
    ...overrides,
  };
}

describe("sortByDraftability", () => {
  it("puts rostered players above unrostered ones", () => {
    // The real bug: retired kickers carry old low ranks and would sort
    // above every active kicker, all of whom sit at 999.
    const retiredButRanked = player("Justin Tucker", {
      nfl_team: null,
      search_rank: 182,
    });
    const activeUnranked = player("Jason Myers");

    const sorted = sortByDraftability([retiredButRanked, activeUnranked]);
    expect(sorted[0].full_name).toBe("Jason Myers");
  });

  it("keeps everyone in the list rather than filtering", () => {
    // "All kickers are available" is a league rule - the retired ones sink,
    // they don't disappear.
    const players = [
      player("Retired Guy", { nfl_team: null, search_rank: 100 }),
      player("Active Guy"),
    ];
    expect(sortByDraftability(players)).toHaveLength(2);
    expect(
      sortByDraftability(players).map((p) => p.full_name)
    ).toContain("Retired Guy");
  });

  it("ranks active above injured above inactive", () => {
    const sorted = sortByDraftability([
      player("Inactive Guy", { status: "Inactive" }),
      player("Injured Guy", { status: "Injured Reserve" }),
      player("Active Guy", { status: "Active" }),
    ]);
    expect(sorted.map((p) => p.full_name)).toEqual([
      "Active Guy",
      "Injured Guy",
      "Inactive Guy",
    ]);
  });

  it("uses search_rank within the same tier", () => {
    const sorted = sortByDraftability([
      player("Third", { search_rank: 30 }),
      player("First", { search_rank: 10 }),
      player("Second", { search_rank: 20 }),
    ]);
    expect(sorted.map((p) => p.full_name)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("treats 999 and null as unranked, below any real rank", () => {
    const sorted = sortByDraftability([
      player("Filler", { search_rank: 999 }),
      player("Missing", { search_rank: null }),
      player("Real", { search_rank: 400 }),
    ]);
    expect(sorted[0].full_name).toBe("Real");
    expect(sorted[2].full_name).toBe("Missing");
  });

  it("falls back to alphabetical so ties are stable, not arbitrary", () => {
    // Hundreds of players share rank 999; without this the order would
    // depend on however the rows came back from the database.
    const sorted = sortByDraftability([
      player("Zeta"),
      player("Alpha"),
      player("Mike"),
    ]);
    expect(sorted.map((p) => p.full_name)).toEqual(["Alpha", "Mike", "Zeta"]);
  });

  it("does not mutate the input", () => {
    const players = [player("B", { search_rank: 20 }), player("A", { search_rank: 10 })];
    const before = players.map((p) => p.full_name);
    sortByDraftability(players);
    expect(players.map((p) => p.full_name)).toEqual(before);
  });

  it("keeps the real top of the draft at the top", () => {
    // Skill positions have genuine ranks and must not be disturbed by any
    // of the kicker-driven tie-breaking above.
    const sorted = sortByDraftability([
      player("Ja'Marr Chase", { position: "WR", nfl_team: "CIN", search_rank: 3 }),
      player("Bijan Robinson", { position: "RB", nfl_team: "ATL", search_rank: 1 }),
      player("Josh Allen", { position: "QB", nfl_team: "BUF", search_rank: 2 }),
    ]);
    expect(sorted.map((p) => p.full_name)).toEqual([
      "Bijan Robinson",
      "Josh Allen",
      "Ja'Marr Chase",
    ]);
  });

  it("handles an empty pool", () => {
    expect(sortByDraftability([])).toEqual([]);
  });

  it("treats an empty team string as unrostered", () => {
    const sorted = sortByDraftability([
      player("Blank Team", { nfl_team: "", search_rank: 5 }),
      player("Real Team", { nfl_team: "SEA", search_rank: 500 }),
    ]);
    expect(sorted[0].full_name).toBe("Real Team");
  });
});
