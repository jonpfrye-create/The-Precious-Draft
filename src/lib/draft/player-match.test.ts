import { describe, expect, it } from "vitest";
import { matchKey, normalizePlayerName } from "./player-match";

describe("normalizePlayerName", () => {
  it("ignores case and spacing", () => {
    expect(normalizePlayerName("  Josh   ALLEN ")).toBe("josh allen");
  });

  it("matches initials written with and without periods", () => {
    expect(normalizePlayerName("D.J. Moore")).toBe(
      normalizePlayerName("DJ Moore")
    );
    expect(normalizePlayerName("T.J. Hockenson")).toBe(
      normalizePlayerName("TJ Hockenson")
    );
  });

  it("matches apostrophes written either way", () => {
    expect(normalizePlayerName("Ja'Marr Chase")).toBe(
      normalizePlayerName("JaMarr Chase")
    );
    // Curly apostrophe, which is what a copy-paste tends to produce.
    expect(normalizePlayerName("Ja’Marr Chase")).toBe(
      normalizePlayerName("Ja'Marr Chase")
    );
  });

  it("drops generational suffixes", () => {
    expect(normalizePlayerName("Marvin Harrison Jr.")).toBe("marvin harrison");
    expect(normalizePlayerName("Kenneth Walker III")).toBe("kenneth walker");
    expect(normalizePlayerName("Odell Beckham Jr")).toBe("odell beckham");
  });

  it("keeps a surname that only looks like a suffix", () => {
    // Dropping every trailing token would leave nothing behind.
    expect(normalizePlayerName("Jr")).toBe("jr");
  });

  it("handles hyphenated names", () => {
    expect(normalizePlayerName("Amon-Ra St. Brown")).toBe("amonra st brown");
  });

  it("does not collapse two different players together", () => {
    expect(normalizePlayerName("Josh Allen")).not.toBe(
      normalizePlayerName("Keenan Allen")
    );
    expect(normalizePlayerName("Michael Thomas")).not.toBe(
      normalizePlayerName("Michael Pittman")
    );
  });
});

describe("matchKey", () => {
  it("requires the position to agree", () => {
    // Two real players share this name at different positions; matching on
    // name alone would swap them.
    expect(matchKey("Josh Allen", "QB", "BUF")).not.toBe(
      matchKey("Josh Allen", "LB", "JAX")
    );
  });

  it("matches a player across feeds that spell them differently", () => {
    expect(matchKey("Marvin Harrison Jr.", "WR", "ARI")).toBe(
      matchKey("Marvin Harrison", "WR", "ARI")
    );
  });

  it("ignores the NFL team for skill players", () => {
    // Feeds disagree constantly about a player's team after a trade; the
    // player is still the same player.
    expect(matchKey("Bijan Robinson", "RB", "ATL")).toBe(
      matchKey("Bijan Robinson", "RB", null)
    );
  });

  it("matches defenses on their team code, not their name", () => {
    // "Ravens", "Baltimore Ravens" and "Baltimore" are all the same thing.
    expect(matchKey("Ravens", "DEF", "BAL")).toBe(
      matchKey("Baltimore Ravens", "DEF", "BAL")
    );
    expect(matchKey("Ravens", "DEF", "BAL")).not.toBe(
      matchKey("Steelers", "DEF", "PIT")
    );
  });
});

describe("accented names", () => {
  it("matches a name spelled with and without accents", () => {
    // The one player who failed against the real feed: FFC writes
    // "Eddy Piñeiro", Sleeper writes "Eddy Pineiro".
    expect(normalizePlayerName("Eddy Piñeiro")).toBe(
      normalizePlayerName("Eddy Pineiro")
    );
  });

  it("keeps the letter rather than splitting the word", () => {
    expect(normalizePlayerName("Piñeiro")).toBe("pineiro");
  });

  it("handles other accents the same way", () => {
    expect(normalizePlayerName("José Álvarez")).toBe("jose alvarez");
  });
});
