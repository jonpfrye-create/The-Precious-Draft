/**
 * A 3x5 pixel font, for the two bits of text that belong *inside* the
 * picture rather than on the page around it.
 *
 * The mountain needs its own name on it - printing "Bijan Gibbs
 * Mountain" as an HTML heading above the canvas explains the joke before
 * anyone has seen it. And twelve mascots at this size are not tellable
 * apart by jersey colour alone, so each one carries the first few
 * letters of its team.
 *
 * Four pixels wide. Three is narrower and was tried first, but M and N
 * are the same shape at three pixels however they are drawn - the
 * mountain introduced itself as BIJAM GIBBS MOUNTAIM - and legibility
 * across a room is the entire point of putting text in here at all.
 *
 * Everything is upper case; there are no lower-case shapes, and
 * `drawText` upper-cases on the way in rather than dropping them.
 */

const GLYPHS: Record<string, string[]> = {
  A: [".##.", "#..#", "####", "#..#", "#..#"],
  B: ["###.", "#..#", "###.", "#..#", "###."],
  C: [".###", "#...", "#...", "#...", ".###"],
  D: ["###.", "#..#", "#..#", "#..#", "###."],
  E: ["####", "#...", "###.", "#...", "####"],
  F: ["####", "#...", "###.", "#...", "#..."],
  G: [".###", "#...", "#.##", "#..#", ".###"],
  H: ["#..#", "#..#", "####", "#..#", "#..#"],
  I: [".###", "..#.", "..#.", "..#.", ".###"],
  J: ["..##", "...#", "...#", "#..#", ".##."],
  K: ["#..#", "#.#.", "##..", "#.#.", "#..#"],
  L: ["#...", "#...", "#...", "#...", "####"],
  M: ["#..#", "####", "####", "#..#", "#..#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".##.", "#..#", "#..#", "#..#", ".##."],
  P: ["###.", "#..#", "###.", "#...", "#..."],
  Q: [".##.", "#..#", "#..#", ".##.", "..##"],
  R: ["###.", "#..#", "###.", "#.#.", "#..#"],
  S: [".###", "#...", ".##.", "...#", "###."],
  T: ["####", "..#.", "..#.", "..#.", "..#."],
  U: ["#..#", "#..#", "#..#", "#..#", ".##."],
  V: ["#..#", "#..#", "#..#", ".##.", ".##."],
  W: ["#..#", "#..#", "####", "####", "#..#"],
  X: ["#..#", "#..#", ".##.", "#..#", "#..#"],
  Y: ["#..#", "#..#", ".##.", "..#.", "..#."],
  Z: ["####", "...#", ".##.", "#...", "####"],
  "0": [".##.", "#.##", "####", "##.#", ".##."],
  "1": ["..#.", ".##.", "..#.", "..#.", ".###"],
  "2": ["###.", "...#", ".##.", "#...", "####"],
  "3": ["###.", "...#", ".##.", "...#", "###."],
  "4": ["#..#", "#..#", "####", "...#", "...#"],
  "5": ["####", "#...", "###.", "...#", "###."],
  "6": [".##.", "#...", "###.", "#..#", ".##."],
  "7": ["####", "...#", "..#.", ".#..", ".#.."],
  "8": [".##.", "#..#", ".##.", "#..#", ".##."],
  "9": [".##.", "#..#", ".###", "...#", ".##."],
  " ": ["....", "....", "....", "....", "...."],
  ".": ["....", "....", "....", "....", ".#.."],
  "'": [".#..", ".#..", "....", "....", "...."],
  "-": ["....", "....", "###.", "....", "...."],
};

export const GLYPH_W = 4;
export const GLYPH_H = 5;
/** One blank column between characters. */
export const TRACKING = 1;

/** How wide a string comes out, in pixels. */
export function textWidth(text: string): number {
  const n = text.length;
  return n === 0 ? 0 : n * GLYPH_W + (n - 1) * TRACKING;
}

export interface GlyphTarget {
  px(x: number, y: number, on: boolean): void;
}

/**
 * Walks the pixels of a string, handing each one to `plot`.
 *
 * Deliberately does not know about colour or outlines - the mountain
 * draws its labels with a dark halo so they survive being over snow and
 * over night sky in the same shot, and that is the caller's business.
 */
export function eachTextPixel(
  text: string,
  plot: (x: number, y: number) => void
) {
  let cx = 0;
  for (const raw of text.toUpperCase()) {
    const glyph = GLYPHS[raw] ?? GLYPHS[" "];
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (glyph[y][x] === "#") plot(cx + x, y);
      }
    }
    cx += GLYPH_W + TRACKING;
  }
}

/**
 * The short label a mascot carries up the mountain.
 *
 * Three letters, from the team name rather than the manager's - team
 * names in this league are stored as "Team Name - Manager".
 */
export function shortLabel(teamName: string, length = 3): string {
  const letters = teamName.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, length) || "???").toUpperCase();
}
