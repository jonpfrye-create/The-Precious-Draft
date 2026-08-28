import { hashString } from "@/lib/random/seeded";

/**
 * Twelve mascots, drawn as pixels.
 *
 * These are data rather than image files on purpose. The team colour has
 * to land on the *shirt* - the previous mascot race hue-rotated one
 * shared sprite, which tinted the whole animal and gave the league a
 * green eagle and a purple horse. A sprite that names its own jersey
 * pixels can be recoloured twelve ways without touching the animal.
 *
 * Every mascot is a distinct head on a shared body, which is both the
 * cheap way to draw twelve of these and the correct way: a mascot
 * costume *is* a big head on a person in a shirt. The silhouette carries
 * the identity, because at sixteen pixels across, seen from a sofa,
 * colour does not.
 *
 * ## The grid
 *
 *   .  transparent      k  outline
 *   e  eye              w  white / light
 *   1  primary          2  secondary      3  tertiary
 *   J  jersey           S  jersey shadow
 *
 * `J` and `S` are substituted with the team's colour at draw time. `e`
 * is marked rather than baked so the announcement card can find the eyes
 * and cross them out - see `eyeClusters()`. Nothing downstream carries a
 * list of eye coordinates that could drift away from the art.
 */

export const SPRITE_W = 16;
export const HEAD_H = 10;
export const BODY_H = 9;
export const SPRITE_H = HEAD_H + BODY_H;

export interface Mascot {
  id: string;
  /** Shown on the announcement card under the busted face. */
  name: string;
  palette: { 1: string; 2: string; 3: string; w: string };
  head: string[];
}

const OUTLINE = "#14100d";

/**
 * The body every mascot wears: shoulders, sleeves, and the jersey the
 * team colour goes on.
 *
 * Two leg frames. The climb is paused far more than it moves, so this is
 * doing less work than it would in a running race - but a pack of
 * mascots frozen mid-mountain with their feet together looks dead, and
 * two frames is the difference between waiting and climbing.
 */
const BODY: string[] = [
  "....kkkkkkkk....",
  "...kJJJJJJJJk...",
  "..kkJJJJJJJJkk..",
  ".k11kJJSSJJk11k.",
  ".k11kJJJJJJk11k.",
  ".kkkkJJJJJJkkkk.",
];

/**
 * Legs, in the mascot's own secondary colour rather than in outline.
 *
 * The first pass drew them in `k` - and `k` is very nearly the colour of
 * the sky behind the mountain, so every mascot appeared to be a floating
 * torso. Anything meant to be seen against both snow and night needs a
 * fill, not just a line.
 */
const LEGS: [string[], string[]] = [
  ["....kJJJJJJk....", "....k2k.k2k.....", "...kk2k.k2kk...."],
  ["....kJJJJJJk....", "...k2k...k2k....", "..kk2k...k2kk..."],
];

/**
 * The twelve.
 *
 * Chosen so the *shapes* separate at a glance: horns that curl, horns
 * that spread, horns on a helmet; ears round and ears pointed; a hat, a
 * fin, a plume, antennae. Two birds are told apart by the brow and the
 * beak rather than by being a different bird.
 */
export const MASCOTS: readonly Mascot[] = [
  {
    id: "eagle",
    name: "EAGLE",
    palette: { 1: "#f4efe4", 2: "#e8a33d", 3: "#8a6a3a", w: "#ffffff" },
    head: [
      "................",
      ".....kkkkkk.....",
      "....k111111k....",
      "...k11111111k...",
      "...k1e1111e1k...",
      "...k11111111k...",
      "....k112211k....",
      ".....k2222k.....",
      "......k22k......",
      ".......kk.......",
    ],
  },
  {
    id: "falcon",
    name: "FALCON",
    palette: { 1: "#6b7a86", 2: "#e0c04a", 3: "#2f3a44", w: "#f4efe4" },
    head: [
      "................",
      ".....kkkkkk.....",
      "....k333333k....",
      "...k33333333k...",
      "...k3e3333e3k...",
      "...k11111111k...",
      "....k112211k....",
      ".....k222k......",
      "......kk........",
      "................",
    ],
  },
  {
    id: "colt",
    name: "COLT",
    palette: { 1: "#b5793f", 2: "#f4efe4", 3: "#3a2418", w: "#f4efe4" },
    // Front on, with a long tapering face. The first attempt was drawn
    // in profile on the theory that a horse seen head-on is a blob; it
    // came out an unreadable lopsided smudge, and every other mascot
    // faces front.
    //
    // The white blaze is what actually does the work. Muzzle length
    // alone left it and the bear as two brown lumps four cells apart -
    // one marking down the face and it is unmistakably a horse, which is
    // presumably why real horses are identified that way.
    head: [
      "..kk........kk..",
      "..k3k......k3k..",
      "..k33kkkkkk33k..",
      "...k111ww111k...",
      "...k1e1ww1e1k...",
      "....k11ww11k....",
      ".....k1ww1k.....",
      ".....k1ww1k.....",
      ".....k2222k.....",
      "......kkkk......",
    ],
  },
  {
    id: "prospector",
    name: "PROSPECTOR",
    palette: { 1: "#d9a97a", 2: "#f4efe4", 3: "#5a4028", w: "#ffffff" },
    head: [
      ".....kkkkkk.....",
      "....k333333k....",
      "..kk33333333kk..",
      "..k3333333333k..",
      "...k11111111k...",
      "...k1e1111e1k...",
      "....k111111k....",
      "...k22222222k...",
      "...k22222222k...",
      "....k2222k......",
    ],
  },
  {
    id: "bear",
    name: "BEAR",
    palette: { 1: "#7a5232", 2: "#c9a37a", 3: "#3a2418", w: "#ffffff" },
    head: [
      "..kk........kk..",
      ".k11k......k11k.",
      ".k131k....k131k.",
      "..k1111111111k..",
      "...k11111111k...",
      "...k1e1111e1k...",
      "...k11222211k...",
      "....k223322k....",
      ".....k2222k.....",
      "......kkkk......",
    ],
  },
  {
    id: "ram",
    name: "RAM",
    palette: { 1: "#d8d2c4", 2: "#8a7a5a", 3: "#5a4a2a", w: "#ffffff" },
    head: [
      "..kkk......kkk..",
      ".k222k....k222k.",
      "k22k22k..k22k22k",
      "k2k.k22kk22k.k2k",
      ".k...k111111k...",
      "......k1e11ek...",
      "......k111111k..",
      ".......k1111k...",
      ".......k22k.....",
      "........kk......",
    ],
  },
  {
    id: "bull",
    name: "BULL",
    palette: { 1: "#3a3a42", 2: "#d8d2c4", 3: "#c1391f", w: "#ffffff" },
    head: [
      "................",
      "kk............kk",
      "k2kk........kk2k",
      ".k22kkkkkkkk22k.",
      "..kk11111111kk..",
      "...k1e1111e1k...",
      "...k11111111k...",
      "....k222222k....",
      "....k232232k....",
      ".....kkkkk......",
    ],
  },
  {
    id: "viking",
    name: "VIKING",
    palette: { 1: "#e0b07a", 2: "#d8d2c4", 3: "#e8c05a", w: "#ffffff" },
    head: [
      "..kk........kk..",
      ".k22k......k22k.",
      ".k22kkkkkkkk22k.",
      "..kk2222222kk...",
      "...k11111111k...",
      "...k1e1111e1k...",
      "...k33333333k...",
      "...k33333333k...",
      "....k333333k....",
      ".....k3333k.....",
    ],
  },
  {
    id: "wolf",
    name: "WOLF",
    palette: { 1: "#6a6a74", 2: "#d8d2c4", 3: "#2a2a30", w: "#ffffff" },
    // Ears pulled in off the edges and made solid triangles, and the
    // snout darkened rather than lightened. Both changes are for the
    // same reason: sat wide with a pale muzzle spreading across the jaw,
    // this had the exact silhouette of the bull three cells away.
    head: [
      "..k..........k..",
      "..kk........kk..",
      "..k1k......k1k..",
      "..k11kkkkkk11k..",
      "...k11111111k...",
      "...k1e1111e1k...",
      "....k111111k....",
      "....k133331k....",
      ".....k3333k.....",
      "......k33k......",
    ],
  },
  {
    id: "shark",
    name: "SHARK",
    palette: { 1: "#5a7a8a", 2: "#f4efe4", 3: "#2a3a44", w: "#ffffff" },
    head: [
      ".......kk.......",
      "......k1k.......",
      ".....k11k.......",
      "....k1111kkk....",
      "...k11111111k...",
      "...k1e1111e1k...",
      "...k11111111k...",
      "...k22222222k...",
      "...k2k2k2k2k2k..",
      "....kkkkkkk.....",
    ],
  },
  {
    id: "hornet",
    name: "HORNET",
    palette: { 1: "#e8c02a", 2: "#2a2418", 3: "#f4efe4", w: "#ffffff" },
    head: [
      "..k..........k..",
      "...k........k...",
      "...k3k....k3k...",
      "....kkkkkkkk....",
      "...k11111111k...",
      "...k1eeeeee1k...",
      "...k22222222k...",
      "...k11111111k...",
      "....k222222k....",
      ".....kkkkkk.....",
    ],
  },
  {
    id: "knight",
    name: "KNIGHT",
    palette: { 1: "#b8bcc4", 2: "#c1391f", 3: "#3a3a42", w: "#ffffff" },
    head: [
      ".......k22k.....",
      "......k2222k....",
      ".....kk222kk....",
      "....k111111k....",
      "...k11111111k...",
      "...kkeeeeeekk...",
      "...k11111111k...",
      "...k11k11k11k...",
      "....k111111k....",
      ".....kkkkkk.....",
    ],
  },
] as const;

/** Darkens a hex colour, for the jersey's shaded pixels. */
export function shade(hex: string, amount = 0.62): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return hex;
  const to = (v: number) => Math.round(v * amount);
  const out = ((to((n >> 16) & 255) << 16) |
    (to((n >> 8) & 255) << 8) |
    to(n & 255)) >>> 0;
  return `#${out.toString(16).padStart(6, "0")}`;
}

/** The full sprite grid: head, body, and one of the two leg frames. */
export function spriteRows(mascot: Mascot, frame: 0 | 1 = 0): string[] {
  return [...mascot.head, ...BODY, ...LEGS[frame]];
}

/**
 * Resolves a grid character to a colour, or null for transparent.
 *
 * `jersey` is the team's hex. Everything else comes off the mascot's own
 * palette, so the animal stays the colour it was drawn.
 */
export function colourFor(
  ch: string,
  mascot: Mascot,
  jersey: string
): string | null {
  switch (ch) {
    case ".":
      return null;
    case "k":
      return OUTLINE;
    case "e":
      return OUTLINE;
    case "J":
      return jersey;
    case "S":
      return shade(jersey);
    case "w":
      return mascot.palette.w;
    case "1":
      return mascot.palette[1];
    case "2":
      return mascot.palette[2];
    case "3":
      return mascot.palette[3];
    default:
      return null;
  }
}

/**
 * Where the eyes are, as one point per eye, found from the `e` pixels in
 * the art itself.
 *
 * The busted-up face on the announcement card crosses these out. Reading
 * them from the grid rather than storing coordinates alongside it means
 * redrawing a head can never leave the Xs floating on its forehead.
 * Adjacent `e` pixels are one eye; a gap starts another.
 */
export function eyeClusters(mascot: Mascot): { x: number; y: number }[] {
  const clusters: { x: number; y: number }[] = [];

  mascot.head.forEach((row, y) => {
    let run: number[] = [];
    const flush = () => {
      if (!run.length) return;
      clusters.push({ x: run.reduce((a, b) => a + b, 0) / run.length, y });
      run = [];
    };
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "e") run.push(x);
      else flush();
    }
    flush();
  });

  return clusters;
}

/**
 * Hands every team a different mascot, the same way on every screen.
 *
 * Seeded off the phase so a league does not get the same twelve pairings
 * in Leftovers that it had in Main - but fixed within a phase, because a
 * mascot that changed species on a re-render would be unwatchable. Teams
 * are dealt in a seeded order rather than by hashing each one to an index
 * independently, which would have collided and handed two teams the same
 * animal.
 */
export function assignMascots(
  teamIds: string[],
  seed: string
): Map<string, Mascot> {
  const pool = [...MASCOTS].sort(
    (a, b) => hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`)
  );
  const dealt = [...teamIds].sort(
    (a, b) => hashString(`${seed}:m:${a}`) - hashString(`${seed}:m:${b}`)
  );
  return new Map(dealt.map((id, i) => [id, pool[i % pool.length]]));
}
