import { hashString } from "@/lib/random/seeded";

export interface TeamColor {
  /** Background / accent colour. */
  hex: string;
  /** Text colour that stays legible on top of `hex`. */
  onHex: string;
  name: string;
}

// Twelve hues that stay distinct on a TV across a room, and stay distinct
// from each other - no two neighbouring hues, nothing so dark it dies
// against a black stage or so pale it blows out. Order matters: adjacent
// entries are far apart on the wheel, so a league of four or five teams
// still gets obviously different colours.
export const TEAM_PALETTE: TeamColor[] = [
  { name: "red", hex: "#E03131", onHex: "#FFFFFF" },
  { name: "cyan", hex: "#22B8CF", onHex: "#08131A" },
  { name: "amber", hex: "#F59F00", onHex: "#1A1200" },
  { name: "indigo", hex: "#4C6EF5", onHex: "#FFFFFF" },
  { name: "lime", hex: "#74B816", onHex: "#0D1600" },
  { name: "pink", hex: "#E64980", onHex: "#FFFFFF" },
  { name: "teal", hex: "#0CA678", onHex: "#00140E" },
  { name: "orange", hex: "#F76707", onHex: "#1A0A00" },
  { name: "blue", hex: "#1C7ED6", onHex: "#FFFFFF" },
  { name: "green", hex: "#2F9E44", onHex: "#03140A" },
  { name: "violet", hex: "#7048E8", onHex: "#FFFFFF" },
  { name: "crimson", hex: "#C2255C", onHex: "#FFFFFF" },
];

/**
 * Gives every team a colour, keyed off its id so the colour survives a
 * redraw and a rename.
 *
 * Teams are seeded by hash and collisions resolved by probing for the next
 * free slot, so up to twelve teams always get twelve different colours
 * rather than two of them clashing.
 *
 * IMPORTANT: pass the whole *league's* teams, not one phase's subset.
 * Probing means the assignment depends on which teams are present, so
 * feeding it the eight Leftovers teams would recolour half of them. Callers
 * use getTeamsForLeague and then look up the subset they care about, which
 * is what keeps a team the same colour across all three phases.
 */
export function assignTeamColors(
  teams: readonly { id: string }[]
): Map<string, TeamColor> {
  const taken = new Set<number>();
  const result = new Map<string, TeamColor>();

  // Sorted so assignment doesn't depend on the order rows came back in.
  const ordered = [...teams].sort((a, b) => a.id.localeCompare(b.id));

  for (const team of ordered) {
    const start = hashString(team.id) % TEAM_PALETTE.length;
    let index = start;
    // Probe forward for a free colour. Past twelve teams the palette has to
    // repeat, so bail out and reuse rather than looping forever.
    for (let step = 0; step < TEAM_PALETTE.length; step++) {
      const candidate = (start + step) % TEAM_PALETTE.length;
      if (!taken.has(candidate)) {
        index = candidate;
        break;
      }
    }
    taken.add(index);
    result.set(team.id, TEAM_PALETTE[index]);
  }
  return result;
}

export interface TeamNameParts {
  teamName: string;
  manager: string | null;
}

/**
 * Splits "Prestige Worldwide - Larry" into its team name and its manager.
 *
 * This league writes team names that way, and a broadcast lower-third wants
 * them on separate lines. Splits on the LAST " - " so a team name that
 * contains a dash keeps it. Anything without the separator comes back whole
 * with no manager, rather than being mangled.
 */
export function splitTeamName(fullName: string): TeamNameParts {
  const separator = " - ";
  const index = fullName.lastIndexOf(separator);
  if (index === -1) {
    return { teamName: fullName.trim(), manager: null };
  }
  const teamName = fullName.slice(0, index).trim();
  const manager = fullName.slice(index + separator.length).trim();
  if (!teamName || !manager) {
    return { teamName: fullName.trim(), manager: null };
  }
  return { teamName, manager };
}

/**
 * Up to two initials for the monogram plate, taken from the team name
 * rather than the manager. Skips words that start with punctuation or
 * digits so "50 Shades of Gay" doesn't come out as "5S".
 */
export function teamInitials(fullName: string): string {
  const { teamName } = splitTeamName(fullName);
  const words = teamName
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}]+/u, ""))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    // Nothing alphabetic at all - fall back to the first character so the
    // plate is never empty.
    return teamName.slice(0, 1).toUpperCase() || "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
