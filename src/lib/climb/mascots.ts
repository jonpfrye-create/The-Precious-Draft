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
 * costume *is* a big head on a person in a shirt.
 *
 * The heads are 24x18. They were 16x10, and that was simply too few
 * pixels for the job - at that size a bull and a wolf cannot be told
 * apart, because a snout and a horn cannot both exist. Drawing them
 * larger on the announcement card made them bigger without making them
 * better, which is the tell that the ceiling was the art and not the
 * presentation.
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

export const SPRITE_W = 24;
export const HEAD_H = 18;
export const BODY_H = 13;
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
  ".........k1111k.........",
  "......kkkkkkkkkkkk......",
  ".....kJJJJJJJJJJJJk.....",
  "...kkkJJJJJJJJJJJJkkk...",
  "..k111JJJJSSSSJJJJ111k..",
  "..k111JJJJSSSSJJJJ111k..",
  "..k11kJJJJJJJJJJJJk11k..",
  "..kkkkJJJJJJJJJJJJkkkk..",
  ".....kJJJJJJJJJJJJk.....",
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
  [
    ".....kJJJJJJJJJJJJk.....",
    ".......k22k..k22k.......",
    ".......k22k..k22k.......",
    "......kk22k..k22kk......",
  ],
  [
    ".....kJJJJJJJJJJJJk.....",
    "......k22k....k22k......",
    ".....k22k......k22k.....",
    "....kk22k......k22kk....",
  ],
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
      "........................",
      "......kkkkkkkkkkkk......",
      ".....k111111111111k.....",
      "....k11111111111111k....",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "...k1111112222111111k...",
      "....k11122222222111k....",
      ".....k112222222211k.....",
      "......k1122222211k......",
      ".......k22222222k.......",
      "........k222222k........",
      ".........kkkkkk.........",
      "........................",
      "........................",
    ],
  },
  {
    id: "falcon",
    name: "FALCON",
    // A narrower crown and a short hooked beak. Drawn with the eagle's
    // outline and only a darker palette, the two were the same bird -
    // the silhouette test caught it, and so had the commissioner.
    palette: { 1: "#6b7a86", 2: "#e0c04a", 3: "#2f3a44", w: "#f4efe4" },
    head: [
      "........................",
      ".......kkkkkkkkkk.......",
      "......k3333333333k......",
      ".....k333333333333k.....",
      "....k33333333333333k....",
      "...k3333333333333333k...",
      "...k333ee333333ee333k...",
      "...k333ee333333ee333k...",
      "...k3333333333333333k...",
      "...k3331122222211333k...",
      "....k33112222221133k....",
      ".....k331222222133k.....",
      "......k3312222133k......",
      ".......k33222233k.......",
      "........k222222k........",
      ".........k2222k.........",
      "..........kkkk..........",
      "........................",
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
      "...kk..............kk...",
      "..k33k............k33k..",
      "..k333kkkkkkkkkkkk333k..",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "...k11111wwwwww11111k...",
      "...k111eewwwwwwee111k...",
      "...k111eewwwwwwee111k...",
      "...k11111wwwwww11111k...",
      "....k1111wwwwww1111k....",
      ".....k111wwwwww111k.....",
      "......k11wwwwww11k......",
      "......k11wwwwww11k......",
      ".......k1wwwwww1k.......",
      ".......k22222222k.......",
      "........k222222k........",
      ".........kkkkkk.........",
      "........................",
    ],
  },
  {
    id: "prospector",
    name: "PROSPECTOR",
    palette: { 1: "#d9a97a", 2: "#f4efe4", 3: "#5a4028", w: "#ffffff" },
    head: [
      "......kkkkkkkkkkkk......",
      ".....k333333333333k.....",
      ".....k333333333333k.....",
      ".kkkkkkkkkkkkkkkkkkkkkk.",
      ".k33333333333333333333k.",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "...k2222222222222222k...",
      "...k2222222222222222k...",
      "....k22222222222222k....",
      "....k22222222222222k....",
      ".....k222222222222k.....",
      "......k2222222222k......",
      ".......kkkkkkkkkk.......",
      "........................",
    ],
  },
  {
    id: "bear",
    name: "BEAR",
    palette: { 1: "#7a5232", 2: "#c9a37a", 3: "#3a2418", w: "#ffffff" },
    head: [
      "..kkkk..........kkkk....",
      ".k1111k........k1111k...",
      "k111311k......k113111k..",
      "k113311k......k113311k..",
      ".k11111kkkkkkkk11111k...",
      "..k1111111111111111k....",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "....k11222222222211k....",
      ".....k222222222222k.....",
      "......k2222332222k......",
      ".......k22333322k.......",
      "........k223322k........",
      ".........k2222k.........",
      "..........kkkk..........",
      "........................",
    ],
  },
  {
    id: "ram",
    name: "RAM",
    palette: { 1: "#d8d2c4", 2: "#8a7a5a", 3: "#5a4a2a", w: "#ffffff" },
    head: [
      "..kkk..............kkk..",
      ".k222k............k222k.",
      "k22k22k..........k22k22k",
      "k2k.k22kkkkkkkkkk22k.k2k",
      "k22k.k2222222222k2k.k22k",
      ".k22kkk11111111kkk22k...",
      "..kkk3k11111111k3kkk....",
      "...k111ee1111ee111k.....",
      "...k111ee1111ee111k.....",
      "...k11111111111111k.....",
      "....k111111111111k......",
      ".....k1122222211k.......",
      "......k22222222k........",
      "......k22222222k........",
      ".......k222222k.........",
      "........kkkkkk..........",
      "........................",
      "........................",
    ],
  },
  {
    id: "bull",
    name: "BULL",
    palette: { 1: "#3a3a42", 2: "#d8d2c4", 3: "#c1391f", w: "#ffffff" },
    head: [
      "kkk..................kkk",
      "k22kk..............kk22k",
      "k2222kk..........kk2222k",
      ".k22222kkkkkkkkkk22222k.",
      "..kk222k11111111k222kk..",
      "....kkk1111111111kkk....",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "....k11222222222211k....",
      ".....k222222222222k.....",
      "......k2222332222k......",
      ".......k22333322k.......",
      "........k223322k........",
      ".........k2222k.........",
      "..........kkkk..........",
      "........................",
    ],
  },
  {
    id: "viking",
    name: "VIKING",
    palette: { 1: "#e0b07a", 2: "#d8d2c4", 3: "#e8c05a", w: "#ffffff" },
    head: [
      "..kk................kk..",
      ".k22k..............k22k.",
      ".k222kkkkkkkkkkkkkk222k.",
      "..k22k222222222222k22k..",
      "...kkk222222222222kkk...",
      "....k22222222222222k....",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "...k3333333333333333k...",
      "...k3333333333333333k...",
      "....k33333333333333k....",
      "....k33333333333333k....",
      ".....k333333333333k.....",
      "......k3333333333k......",
      ".......kkkkkkkkkk.......",
      "........................",
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
      "...kk..............kk...",
      "...k1k............k1k...",
      "..k11k............k11k..",
      "..k111kkkkkkkkkkkk111k..",
      "..k111111111111111111k..",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "....k11111111111111k....",
      ".....k333333333333k.....",
      "......k3333333333k......",
      "......k3333333333k......",
      ".......k33333333k.......",
      ".......k33333333k.......",
      "........k333333k........",
      ".........kkkkkk.........",
      "........................",
    ],
  },
  {
    id: "shark",
    name: "SHARK",
    palette: { 1: "#5a7a8a", 2: "#f4efe4", 3: "#2a3a44", w: "#ffffff" },
    head: [
      "...........kk...........",
      "..........k11k..........",
      ".........k1111k.........",
      "........k111111k........",
      ".......k11111111kkkkk...",
      "....kkk1111111111111k...",
      "...k1111111111111111k...",
      "...k111ee111111ee111k...",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "...k2222222222222222k...",
      "...k2k2k2k2k2k2k2k2k2k..",
      "...k2222222222222222k...",
      "...k2k2k2k2k2k2k2k2k2k..",
      "....k22222222222222k....",
      ".....kkkkkkkkkkkkkk.....",
      "........................",
      "........................",
    ],
  },
  {
    id: "hornet",
    name: "HORNET",
    palette: { 1: "#e8c02a", 2: "#2a2418", 3: "#f4efe4", w: "#ffffff" },
    head: [
      "..k..................k..",
      "...k................k...",
      "....k3k..........k3k....",
      ".....k3k........k3k.....",
      "......kkkkkkkkkkkk......",
      ".....k111111111111k.....",
      "....k11111111111111k....",
      "...k1eeeeee11eeeeee1k...",
      "...k1eeeeee11eeeeee1k...",
      "...k2222222222222222k...",
      "...k2222222222222222k...",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "....k22222222222222k....",
      "....k22222222222222k....",
      ".....k111111111111k.....",
      "......kkkkkkkkkkkk......",
      "........................",
    ],
  },
  {
    id: "knight",
    name: "KNIGHT",
    palette: { 1: "#b8bcc4", 2: "#c1391f", 3: "#3a3a42", w: "#ffffff" },
    head: [
      "..........k22k..........",
      "........kk2222kk........",
      ".......k22222222k.......",
      "......kk22222222kk......",
      ".....k1111111111111k....",
      "....k111111111111111k...",
      "...k1111111111111111k...",
      "...kkeeeeeeeeeeeeeekk...",
      "...kkeeeeeeeeeeeeeekk...",
      "...k1111111111111111k...",
      "...k1111111111111111k...",
      "...k11kk111111kk1111k...",
      "...k11kk111111kk1111k...",
      "....k11111111111111k....",
      "....k11111111111111k....",
      ".....k111111111111k.....",
      "......kkkkkkkkkkkk......",
      "........................",
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
/**
 * Pushes a head down so its lowest drawn row is the last one.
 *
 * Heads are authored with however many blank rows fall out of the
 * drawing - some ended two rows above the bottom, some one - and the
 * body is a fixed thing bolted underneath. Bottom-aligning them puts
 * every chin on the same row, so one neck fits all twelve instead of
 * each mascot floating a different distance above its shoulders.
 */
function bottomAligned(head: string[]): string[] {
  const rows = [...head];
  const blank = ".".repeat(rows[0]?.length ?? SPRITE_W);
  while (rows.length && !/[^.]/.test(rows[rows.length - 1])) rows.pop();
  while (rows.length < head.length) rows.unshift(blank);
  return rows;
}

const ALIGNED = new Map<string, string[]>();

export function headRows(mascot: Mascot): string[] {
  let rows = ALIGNED.get(mascot.id);
  if (!rows) {
    rows = bottomAligned(mascot.head);
    ALIGNED.set(mascot.id, rows);
  }
  return rows;
}

export function spriteRows(mascot: Mascot, frame: 0 | 1 = 0): string[] {
  return [...headRows(mascot), ...BODY, ...LEGS[frame]];
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
  // The aligned rows, not the authored ones - the card draws the same.
  const rows = headRows(mascot);
  const seen = rows.map((r) => Array(r.length).fill(false));
  const out: { x: number; y: number }[] = [];

  // Flood fill rather than a scan per row. Eyes are two pixels tall at
  // this size, and a per-row scan reported every eye twice - four eyes
  // on every mascot, and two crosses stacked on each one.
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== "e" || seen[y][x]) continue;

      const stack = [[x, y]];
      const cells: number[][] = [];
      seen[y][x] = true;

      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        cells.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (ny < 0 || ny >= rows.length) continue;
          if (nx < 0 || nx >= rows[ny].length) continue;
          if (seen[ny][nx] || rows[ny][nx] !== "e") continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }

      out.push({
        x: cells.reduce((a, c) => a + c[0], 0) / cells.length,
        y: cells.reduce((a, c) => a + c[1], 0) / cells.length,
      });
    }
  }

  return out;
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
