import { describe, expect, it } from "vitest";
import { eachTextPixel, GLYPH_H, GLYPH_W, shortLabel, textWidth } from "./font";

/** The pixels of a single character, as a comparable string. */
function shapeOf(ch: string): string {
  const grid = Array.from({ length: GLYPH_H }, () => Array(GLYPH_W).fill("."));
  eachTextPixel(ch, (x, y) => {
    if (y < GLYPH_H && x < GLYPH_W) grid[y][x] = "#";
  });
  return grid.map((r) => r.join("")).join("/");
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

describe("the pixel font", () => {
  it("gives every letter and digit a shape of its own", () => {
    // M and N were the same shape at three pixels wide, whichever way
    // they were drawn, and the mountain introduced itself as BIJAM
    // GIBBS MOUNTAIM. This is that bug, pinned.
    const seen = new Map<string, string>();
    for (const ch of ALPHABET) {
      const shape = shapeOf(ch);
      const clash = seen.get(shape);
      expect(clash, `${ch} is drawn identically to ${clash}`).toBeUndefined();
      seen.set(shape, ch);
    }
  });

  it("draws something for every character it claims to know", () => {
    for (const ch of ALPHABET) {
      expect(shapeOf(ch), ch).toContain("#");
    }
  });

  it("falls back to a blank rather than dropping an unknown character", () => {
    // Team names arrive from a text box; a stray character must not
    // shorten the label and slide the rest of it left.
    expect(textWidth("A?B")).toBe(textWidth("A B"));
    expect(shapeOf("?")).not.toContain("#");
  });

  it("is case-insensitive rather than blank for lower case", () => {
    expect(shapeOf("a")).toBe(shapeOf("A"));
  });

  it("measures what it draws", () => {
    expect(textWidth("")).toBe(0);
    expect(textWidth("A")).toBe(GLYPH_W);
    for (const text of ["AB", "HELLO", "BIJAN GIBBS MOUNTAIN"]) {
      let widest = 0;
      eachTextPixel(text, (x) => {
        widest = Math.max(widest, x + 1);
      });
      // The measured width may exceed the inked width when the last
      // glyph has a blank right-hand column, but never the other way -
      // text must not overrun what was reserved for it.
      expect(widest, text).toBeLessThanOrEqual(textWidth(text));
    }
  });
});

describe("shortLabel", () => {
  it("takes the first three letters of the team name", () => {
    expect(shortLabel("Bell Cows")).toBe("BEL");
    expect(shortLabel("Quarterbacks")).toBe("QUA");
  });

  it("skips punctuation and spaces rather than spending a slot on them", () => {
    expect(shortLabel("A.C. Milan")).toBe("ACM");
    expect(shortLabel("  Jet Fuel")).toBe("JET");
  });

  it("never comes back empty", () => {
    expect(shortLabel("")).toBe("???");
    expect(shortLabel("!!!")).toBe("???");
  });
});
