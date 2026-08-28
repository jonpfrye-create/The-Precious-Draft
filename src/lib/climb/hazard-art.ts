/**
 * What the mountain does to them, drawn as pixels.
 *
 * Same grid convention as the mascots, with a hazard-local palette:
 *
 *   .  transparent   k  outline
 *   a  primary       b  dark        c  accent      w  light
 *
 * Fourteen across so a hazard reads at the same size as the mascot it
 * just accounted for, and no wider - these sit on a mountain face that
 * narrows towards the summit and there is not much room up there.
 *
 * Keyed by the hazard ids in climb.ts. There is a test that every id has
 * art, because a hazard with none would fell a mascot with nothing
 * visibly doing it.
 */

export interface HazardArt {
  palette: { a: string; b: string; c: string; w: string };
  /** Drawn behind the fallen mascot rather than on top of it. */
  behind?: boolean;
  rows: string[];
}

const OUTLINE = "#14100d";

export const HAZARD_ART: Record<string, HazardArt> = {
  boulder: {
    palette: { a: "#6b6b73", b: "#46464e", c: "#8a8a92", w: "#a8a8b0" },
    rows: [
      "....kkkkkk....",
      "..kkaaaaaakk..",
      ".kaaaaaaaaaak.",
      "kaaabaaaabaaak",
      "kaaaaaaaaaaaak",
      "kabaaaaaaaabak",
      "kaaaaaaaaaaaak",
      ".kaaabaaabaak.",
      "..kkaaaaaakk..",
      "....kkkkkk....",
    ],
  },

  // The one everybody is waiting for, so it gets the most pixels: arms
  // out, mouth open, twice the presence of a rock.
  yeti: {
    palette: { a: "#f4f6f8", b: "#2a3038", c: "#c8d4e0", w: "#ffffff" },
    rows: [
      "..w........w..",
      "..ww......ww..",
      ".wwwwwwwwwwww.",
      ".wwkwwwwwwkww.",
      ".wwwwwwwwwwww.",
      ".wwbbbbbbbbww.",
      ".wwbwbwbwbwww.",
      ".wwwbbbbbbwww.",
      "wwwwwwwwwwwwww",
      "wwwwwwwwwwwwww",
      ".w.wwwwwwww.w.",
      "...wwwwwwww...",
      "...ww....ww...",
      "..www....www..",
    ],
  },

  bear: {
    palette: { a: "#7a5232", b: "#2a1a10", c: "#c9a37a", w: "#f4efe4" },
    rows: [
      "..aa......aa..",
      ".aaaa....aaaa.",
      ".aaaaaaaaaaaa.",
      ".aakaaaaaakaa.",
      ".aaaaaaaaaaaa.",
      ".aaabbbbbbaaa.",
      ".aaabwbwbwaaa.",
      "aaaaabbbbaaaaa",
      "aaaaaaaaaaaaaa",
      ".aaaaaaaaaaaa.",
      "..aaaaaaaaaa..",
      "...aa....aa...",
    ],
  },

  eagle: {
    palette: { a: "#4a3a2a", b: "#e8a33d", c: "#8a6a3a", w: "#f4efe4" },
    rows: [
      "aa..........aa",
      "aaaa......aaaa",
      ".aaaaa..aaaaa.",
      "..aaaabbaaaa..",
      "...aaabbaaa...",
      "....abbbba....",
      "....abwwba....",
      ".....bccb.....",
      "......cc......",
    ],
  },

  beartrap: {
    palette: { a: "#8a8a92", b: "#46464e", c: "#6b6b73", w: "#c8c8d0" },
    rows: [
      "k............k",
      "kk..........kk",
      "kak........kak",
      "kaak......kaak",
      ".kaakkkkkkaak.",
      "..kaaaaaaaak..",
      "...kkaaaakk...",
      ".....kkkk.....",
    ],
  },

  rope: {
    palette: { a: "#a87a3a", b: "#6a4a20", c: "#c9a37a", w: "#f4efe4" },
    rows: [
      "......aa......",
      ".....aa.......",
      "......aa......",
      ".....aa.......",
      "......a.......",
      "..............",
      ".......a......",
      "......aa......",
      ".....aa.......",
      "......aa......",
      ".....aa.......",
    ],
  },

  // Terrain rather than an animal, so it is drawn *under* the mascot -
  // they are in the hole, not stood next to it.
  crevasse: {
    palette: { a: "#3a4a5a", b: "#1a2430", c: "#5a6a7a", w: "#c8d4e0" },
    behind: true,
    rows: [
      ".kkkk....kkkk.",
      "kbbbbkkkkbbbbk",
      "kbbbbbbbbbbbbk",
      ".kbbbbbbbbbbk.",
      "..kbbbbbbbbk..",
      "...kbbbbbbk...",
      "....kbbbbk....",
      ".....kbbk.....",
      "......kk......",
    ],
  },

  chasm: {
    palette: { a: "#3a4a5a", b: "#12181f", c: "#5a6a7a", w: "#c8d4e0" },
    behind: true,
    rows: [
      "kkkkkkkkkkkkkk",
      "kbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbk",
      ".kbbbbbbbbbbk.",
      "..kbbbbbbbbk..",
      "...kkbbbbkk...",
      ".....kkkk.....",
    ],
  },

  avalanche: {
    palette: { a: "#c8d4e0", b: "#8aa0b4", c: "#5a6a7a", w: "#ffffff" },
    behind: true,
    rows: [
      "...ww..ww.ww..",
      "..wwww.wwwwww.",
      ".wwwwwwwwwwww.",
      "wwwwwwwwwwwwww",
      "wwwwwwwwwwwwww",
      ".wwwwwwwwwwww.",
      "..wwwwwwwwww..",
      "...wwwwwwww...",
    ],
  },

  icicle: {
    palette: { a: "#c8e4f4", b: "#7aa8c4", c: "#eaf6ff", w: "#dff0fb" },
    rows: [
      "..kk..kk..kk..",
      "..ww..ww..ww..",
      "..ww..ww..ww..",
      "..ww..ww..ww..",
      "...w...w...w..",
      "...w...w...w..",
      "....w...w.....",
    ],
  },

  wolves: {
    palette: { a: "#6a6a74", b: "#2a2a30", c: "#d8d2c4", w: "#f4efe4" },
    rows: [
      ".k..k....k..k.",
      ".kaak....kaak.",
      ".aaaak..aaaak.",
      "aaaaaa..aaaaaa",
      "akaaka..akaaka",
      "aaaaaa..aaaaaa",
      ".abbba...abbba",
      "..bbb.....bbb.",
    ],
  },

  goat: {
    palette: { a: "#8a7a5a", b: "#3a2f26", c: "#d8d2c4", w: "#e8e2d4" },
    rows: [
      "..kk......kk..",
      ".kaak....kaak.",
      ".kaaakkkkaaak.",
      "..kaaaaaaaak..",
      "...kwwwwwwk...",
      "...kwkwwkwk...",
      "...kwwwwwwk...",
      "....kbbbbk....",
      ".....kbbk.....",
    ],
  },

  ice: {
    palette: { a: "#9fc4dd", b: "#5a8aa8", c: "#d8ecf8", w: "#eaf6ff" },
    behind: true,
    rows: [
      "...wwwwwwww...",
      "..wwwaawwwww..",
      ".wwwaawwwwwww.",
      ".wwwwwwwaawww.",
      "..wwwwwwaaww..",
      "...wwwwwwww...",
    ],
  },
};

/** Resolves a hazard grid character to a colour, or null for nothing. */
export function hazardColour(ch: string, art: HazardArt): string | null {
  switch (ch) {
    case ".":
      return null;
    case "k":
      return OUTLINE;
    case "a":
      return art.palette.a;
    case "b":
      return art.palette.b;
    case "c":
      return art.palette.c;
    case "w":
      return art.palette.w;
    default:
      return null;
  }
}
