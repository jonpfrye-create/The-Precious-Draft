import { describe, expect, it } from "vitest";
import {
  assignTeamColors,
  splitTeamName,
  teamInitials,
  TEAM_PALETTE,
} from "./branding";

// The real league's names, because they're the ones that have to work.
const REAL_NAMES = [
  "Sofa King Tactilious - James",
  "50 Shades of Gay - Chris",
  "Battlesnakeowitz - Enzo",
  "Mom! The Meatloaf! - David",
  "Decision at Midnight - Sam",
  "Jonny Clams - Jon",
  "Don’t Look Omarion! - Scott",
  "Prestige Worldwide - Larry",
  "Sacred Chao - Parker",
  "The Gato - Phil",
  "Urine Trouble - Brandon",
  "Green Bud Packers - Deonte",
];

describe("splitTeamName", () => {
  it("splits team name from manager", () => {
    expect(splitTeamName("Prestige Worldwide - Larry")).toEqual({
      teamName: "Prestige Worldwide",
      manager: "Larry",
    });
  });

  it("splits every real team name cleanly", () => {
    for (const name of REAL_NAMES) {
      const parts = splitTeamName(name);
      expect(parts.manager).not.toBeNull();
      expect(parts.teamName.length).toBeGreaterThan(0);
      expect(parts.teamName).not.toContain(" - ");
    }
  });

  it("keeps a dash that belongs to the team name", () => {
    // Splitting on the LAST separator, so only the manager is peeled off.
    expect(splitTeamName("Hyphen - Nation - Dave")).toEqual({
      teamName: "Hyphen - Nation",
      manager: "Dave",
    });
  });

  it("returns the whole name when there's no manager", () => {
    expect(splitTeamName("Just A Team")).toEqual({
      teamName: "Just A Team",
      manager: null,
    });
  });

  it("does not mangle a name with a bare hyphen", () => {
    expect(splitTeamName("Well-Known Team")).toEqual({
      teamName: "Well-Known Team",
      manager: null,
    });
  });

  it("treats a trailing separator as no manager", () => {
    expect(splitTeamName("Team Name - ")).toEqual({
      teamName: "Team Name -",
      manager: null,
    });
  });
});

describe("teamInitials", () => {
  it("uses the first two words of the team name, not the manager", () => {
    expect(teamInitials("Prestige Worldwide - Larry")).toBe("PW");
    expect(teamInitials("Green Bud Packers - Deonte")).toBe("GB");
  });

  it("skips leading digits so numbers don't become initials", () => {
    expect(teamInitials("50 Shades of Gay - Chris")).toBe("SO");
  });

  it("uses two letters when the team name is one word", () => {
    expect(teamInitials("Battlesnakeowitz - Enzo")).toBe("BA");
  });

  it("copes with leading punctuation", () => {
    expect(teamInitials("Don’t Look Omarion! - Scott")).toBe("DL");
  });

  it("always returns something for every real name", () => {
    for (const name of REAL_NAMES) {
      const initials = teamInitials(name);
      expect(initials.length).toBeGreaterThan(0);
      expect(initials.length).toBeLessThanOrEqual(2);
      expect(initials).toBe(initials.toUpperCase());
    }
  });

  it("never returns an empty plate", () => {
    expect(teamInitials("!!! - Bob").length).toBeGreaterThan(0);
    expect(teamInitials("").length).toBeGreaterThan(0);
  });
});

describe("assignTeamColors", () => {
  const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `team-${i}` }));

  it("gives twelve teams twelve different colours", () => {
    const colors = assignTeamColors(twelve);
    const used = new Set([...colors.values()].map((c) => c.hex));
    expect(used.size).toBe(12);
  });

  it("gives every team a colour", () => {
    const colors = assignTeamColors(twelve);
    for (const team of twelve) {
      expect(colors.get(team.id)).toBeDefined();
    }
  });

  it("is stable regardless of the order teams arrive in", () => {
    const forwards = assignTeamColors(twelve);
    const backwards = assignTeamColors([...twelve].reverse());
    for (const team of twelve) {
      expect(backwards.get(team.id)!.hex).toBe(forwards.get(team.id)!.hex);
    }
  });

  it("keeps every team's colour across phases when seeded from the league", () => {
    // How callers must use it: assign from the whole league, then look up
    // whichever subset this phase is drafting. Leftovers and Microwave then
    // inherit Main's colours exactly.
    const leagueColors = assignTeamColors(twelve);
    const leftovers = twelve.slice(0, 8);
    const microwave = twelve.slice(0, 5);

    for (const team of [...leftovers, ...microwave]) {
      expect(leagueColors.get(team.id)).toBeDefined();
    }
    const leftoverHexes = leftovers.map((t) => leagueColors.get(t.id)!.hex);
    expect(new Set(leftoverHexes).size).toBe(leftovers.length);
  });

  it("recolours if seeded from a subset — which is why callers must not", () => {
    // Documents the trap the comment on assignTeamColors warns about: probe
    // order depends on which teams are present, so seeding from a subset is
    // not the same as filtering the league's assignment.
    const full = assignTeamColors(twelve);
    const reseeded = assignTeamColors(twelve.slice(0, 8));
    const changed = twelve
      .slice(0, 8)
      .filter((t) => reseeded.get(t.id)!.hex !== full.get(t.id)!.hex);
    expect(changed.length).toBeGreaterThan(0);
  });

  it("handles more teams than there are colours without hanging", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}` }));
    const colors = assignTeamColors(many);
    expect(colors.size).toBe(20);
  });

  it("handles an empty league", () => {
    expect(assignTeamColors([]).size).toBe(0);
  });

  it("only ever hands out colours from the palette", () => {
    const colors = assignTeamColors(twelve);
    const allowed = new Set(TEAM_PALETTE.map((c) => c.hex));
    for (const color of colors.values()) {
      expect(allowed.has(color.hex)).toBe(true);
    }
  });
});
