// Matching an external ADP feed to the Sleeper pool by name.
//
// There is no shared id between the two, so this is name matching, which
// is exactly as fragile as it sounds: "D.J. Moore" vs "DJ Moore",
// "Marvin Harrison Jr." vs "Marvin Harrison", "Ken Walker III". The
// normalisation below is deliberately aggressive, and position is required
// to agree, so a stray match between two different players is unlikely.
//
// Anything that doesn't match simply has no ADP. That's a visibly missing
// number on a sticker, not a wrong one, which is the right way round.

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizePlayerName(name: string): string {
  const cleaned = name
    .toLowerCase()
    // Strip accents rather than discarding the letter: one feed writes
    // "Piñeiro" and the other "Pineiro", and turning ñ into a space would
    // split the surname into two words that match nothing.
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // Punctuation carries no signal here and is written inconsistently:
    // periods in initials, apostrophes in Ja'Marr, hyphens in double
    // surnames.
    .replace(/[.'’`-]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Generational suffixes appear in one feed and not the other.
  while (cleaned.length > 1 && SUFFIXES.has(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  return cleaned.join(" ");
}

/**
 * Feeds disagree about what a team defense is called - "Ravens", "Baltimore
 * Ravens", "Baltimore". Defenses are matched on their NFL team code instead,
 * which both feeds do agree on.
 */
export function matchKey(
  name: string,
  position: string | null,
  nflTeam: string | null
): string {
  if (position === "DEF") {
    return `DEF:${(nflTeam ?? "").toUpperCase()}`;
  }
  return `${position ?? "?"}:${normalizePlayerName(name)}`;
}
