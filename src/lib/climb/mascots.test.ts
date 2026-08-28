import { describe, expect, it } from "vitest";
import {
  assignMascots,
  colourFor,
  eyeClusters,
  HEAD_H,
  MASCOTS,
  shade,
  SPRITE_H,
  SPRITE_W,
  spriteRows,
} from "./mascots";

// No space. A space used to read as transparent, which meant a slipped
// finger punched a hole in a face and every check still passed - there
// were five of them in the first draft of the art. "." is the only way
// to say "nothing here".
const LEGAL = new Set([".", "k", "e", "w", "1", "2", "3", "J", "S"]);

describe("the art itself", () => {
  it("is rectangular, to the pixel", () => {
    // Pixel grids are hand-typed and a row one character short shears
    // everything below it. Cheap to assert, invisible to eyeball.
    for (const m of MASCOTS) {
      expect(m.head, m.id).toHaveLength(HEAD_H);
      m.head.forEach((row, y) => {
        expect(row.length, `${m.id} head row ${y}: "${row}"`).toBe(SPRITE_W);
      });

      const full = spriteRows(m);
      expect(full, m.id).toHaveLength(SPRITE_H);
      full.forEach((row, y) => {
        expect(row.length, `${m.id} row ${y}: "${row}"`).toBe(SPRITE_W);
      });
    }
  });

  it("uses only characters the renderer knows", () => {
    // An unknown character draws as nothing, so a typo is a hole in the
    // mascot rather than an error.
    for (const m of MASCOTS) {
      for (const [y, row] of spriteRows(m).entries()) {
        for (const ch of row) {
          expect(LEGAL.has(ch), `${m.id} row ${y} has "${ch}"`).toBe(true);
        }
      }
    }
  });

  it("gives every mascot something to cross out", () => {
    // The announcement card draws Xs over these, so a mascot with none
    // gets a face that never registers the disaster.
    //
    // One or two, not always two: the colt is drawn in profile, because
    // a horse seen head-on at this size is a blob, and the hornet and
    // the knight have a single band - compound eyes and a visor slit.
    for (const m of MASCOTS) {
      const eyes = eyeClusters(m);
      expect(eyes.length, `${m.id} has ${eyes.length} eyes`).toBeGreaterThan(0);
      expect(eyes.length, `${m.id} has ${eyes.length} eyes`).toBeLessThan(3);
      for (const eye of eyes) {
        expect(eye.x, m.id).toBeGreaterThanOrEqual(0);
        expect(eye.x, m.id).toBeLessThan(SPRITE_W);
        expect(eye.y, m.id).toBeLessThan(HEAD_H);
      }
    }
  });

  it("is twelve distinct mascots", () => {
    expect(MASCOTS).toHaveLength(12);
    expect(new Set(MASCOTS.map((m) => m.id)).size).toBe(12);
    expect(new Set(MASCOTS.map((m) => m.name)).size).toBe(12);
    // Distinct as *shapes*, not just as palettes - the whole design
    // rests on the silhouette carrying the identity at sixteen pixels
    // across, seen from a sofa.
    const silhouettes = MASCOTS.map((m) =>
      m.head.map((r) => r.replace(/[^. ]/g, "#")).join("/")
    );
    expect(new Set(silhouettes).size).toBe(12);
  });

  it("wears the jersey rather than being dyed by it", () => {
    // The race this replaces hue-rotated one shared sprite and produced
    // a green eagle. The team colour belongs on the shirt.
    const [eagle] = MASCOTS;
    expect(colourFor("J", eagle, "#c1391f")).toBe("#c1391f");
    expect(colourFor("S", eagle, "#c1391f")).toBe(shade("#c1391f"));
    expect(colourFor("1", eagle, "#c1391f")).toBe(eagle.palette[1]);
    // Nothing in a head is a jersey pixel, so no team colour can bleed
    // onto the animal.
    for (const m of MASCOTS) {
      expect(m.head.join("")).not.toMatch(/[JS]/);
    }
  });

  it("draws nothing for a blank and something for every colour key", () => {
    const [m] = MASCOTS;
    expect(colourFor(".", m, "#fff")).toBeNull();
    expect(colourFor(" ", m, "#fff")).toBeNull();
    for (const ch of ["k", "e", "w", "1", "2", "3"]) {
      expect(colourFor(ch, m, "#fff"), ch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("shade", () => {
  it("darkens without leaving the hex", () => {
    expect(shade("#ffffff")).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade("#000000")).toBe("#000000");
    expect(shade("#c1391f")).not.toBe("#c1391f");
    expect(shade("#fff")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("assignMascots", () => {
  it("gives twelve teams twelve different mascots", () => {
    const teams = Array.from({ length: 12 }, (_, i) => `team-${i}`);
    const dealt = assignMascots(teams, "phase-1");
    expect(dealt.size).toBe(12);
    expect(new Set([...dealt.values()].map((m) => m.id)).size).toBe(12);
  });

  it("is stable within a phase and different between phases", () => {
    // A mascot that changed species on a re-render would be
    // unwatchable; the same twelve pairings every phase would be dull.
    const teams = ["a", "b", "c", "d"];
    const one = assignMascots(teams, "phase-1");
    const same = assignMascots(teams, "phase-1");
    const other = assignMascots(teams, "phase-2");

    for (const t of teams) expect(same.get(t)!.id).toBe(one.get(t)!.id);
    expect(teams.some((t) => other.get(t)!.id !== one.get(t)!.id)).toBe(true);
  });

  it("copes with a field that is not twelve", () => {
    for (const size of [1, 5, 8, 12]) {
      const teams = Array.from({ length: size }, (_, i) => `t${i}`);
      const dealt = assignMascots(teams, "s");
      expect(dealt.size, `${size}`).toBe(size);
      expect(new Set([...dealt.values()].map((m) => m.id)).size, `${size}`).toBe(
        size
      );
    }
  });
});
