import { unitFromSeed } from "@/lib/random/seeded";
import type { ClimbScene, Climber } from "./climb";
import { eachTextPixel, textWidth } from "./font";
import { HAZARD_ART, hazardColour } from "./hazard-art";
import {
  colourFor,
  headRows,
  SPRITE_H,
  SPRITE_W,
  spriteRows,
  type Mascot,
} from "./mascots";

/**
 * Bijan Gibbs Mountain, drawn a pixel at a time.
 *
 * Everything goes through `Painter` rather than straight onto a canvas
 * context, for one practical reason: a browser canvas cannot be looked
 * at from a terminal. The same painting code backs onto an ImageData in
 * the browser and onto a PNG buffer in a script, so the scene can
 * actually be *inspected* while it is being built rather than described
 * and hoped for. Three of the twelve mascots were wrong in ways no test
 * would ever have caught and only looking found.
 *
 * The scene is drawn at an eight-bit internal resolution and scaled up
 * with `image-rendering: pixelated`, which is what gives it the SkiFree
 * look and also means a television and a phone draw the same number of
 * pixels.
 */

export type RGB = readonly [number, number, number];

export interface Painter {
  readonly w: number;
  readonly h: number;
  px(x: number, y: number, c: RGB): void;
}

const hexCache = new Map<string, RGB>();

export function rgb(hex: string): RGB {
  const hit = hexCache.get(hex);
  if (hit) return hit;
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  const out: RGB = Number.isFinite(n)
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [255, 0, 255];
  hexCache.set(hex, out);
  return out;
}

const OUTLINE = rgb("#14100d");
const SNOW = rgb("#e8eef4");
const SNOW_SHADE = rgb("#aebeCE".toLowerCase());
const ROCK = rgb("#5a4a3e");
const ROCK_SHADE = rgb("#3a2f26");
const SKY_LOW = rgb("#2a3550");
const SKY_HIGH = rgb("#0b1020");
const STAR = rgb("#e8eef4");
const FLAG = rgb("#c1391f");

/** Ordered dither, so gradients band like an eight-bit screen. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const dither = (x: number, y: number) => BAYER[y & 3][x & 3] / 16;

/**
 * A tile of fixed noise, for breaking up the terrain.
 *
 * Ordered dither on its own bands: because the Bayer matrix repeats
 * every four rows and the snow line moves slowly, whole rows crossed a
 * threshold together and the mountain came out ruled with horizontal
 * dotted lines. Jittering the threshold per pixel scatters the boundary
 * into something that looks like a snow line.
 *
 * A tile rather than a hash per pixel: the first version called into
 * FNV-1a twice for every one of fifty-seven thousand pixels, every
 * frame. Two offset lookups so the sixty-four pixel repeat does not
 * become a visible plaid.
 */
const NOISE_SIZE = 64;
const NOISE = (() => {
  const out = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  let s = 0x9e3779b9;
  for (let i = 0; i < out.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    out[i] = ((s >>> 0) % 10000) / 10000;
  }
  return out;
})();

function noise(x: number, y: number): number {
  const a = NOISE[(y & 63) * NOISE_SIZE + (x & 63)];
  const b = NOISE[((y * 7 + 5) & 63) * NOISE_SIZE + ((x * 3 + 11) & 63)];
  return (a + b) * 0.5;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface Camera {
  /** World y of the top of the visible window. */
  top: number;
  worldH: number;
  baseY: number;
  summitY: number;
}

/**
 * How tall the mountain is, as a multiple of the visible window.
 *
 * Three screens. Fewer and the climb has no sense of distance; more and
 * a single felling barely moves the view, which makes the reveal feel
 * like it has stalled - at four, the opening shot was a wall of rock
 * with no summit anywhere in it.
 */
const WORLD_SCREENS = 3;

export function camera(h: number, packAltitude: number): Camera {
  const worldH = h * WORLD_SCREENS;
  const baseY = worldH - h * 0.25;
  const summitY = h * 0.35;
  const focus = worldYOf(packAltitude, baseY, summitY);
  return {
    // The pack sits low in frame, so most of the screen is the mountain
    // still to come rather than the mountain already climbed.
    top: Math.min(Math.max(focus - h * 0.62, 0), worldH - h),
    worldH,
    baseY,
    summitY,
  };
}

function worldYOf(altitude: number, baseY: number, summitY: number): number {
  return baseY + (summitY - baseY) * altitude;
}

export function worldY(cam: Camera, altitude: number): number {
  return worldYOf(altitude, cam.baseY, cam.summitY);
}

/** Altitude of a given world row - the inverse, for painting terrain. */
function altitudeAt(cam: Camera, y: number): number {
  return (y - cam.baseY) / (cam.summitY - cam.baseY);
}

/**
 * Half the width of the mountain face at a given altitude.
 *
 * Concave rather than a straight taper, and it funnels to almost
 * nothing: twelve mascots spread right across the base converge as they
 * climb, so by the last few fellings they are shoulder to shoulder and
 * the summit is a place only one of them can stand.
 */
export function halfWidth(w: number, altitude: number): number {
  const a = clamp01(altitude);
  // The base stops short of the frame on both sides on purpose. At 0.54
  // the mountain ran off both edges and the opening shot read as a brown
  // wall rather than as something with a top to get to.
  return lerp(w * 0.42, 9, Math.pow(a, 0.85));
}

/** Where a climber stands on screen. */
export function climberXY(
  p: { w: number },
  cam: Camera,
  c: Climber
): { x: number; y: number } {
  const half = halfWidth(p.w, c.altitude);
  // Inset so nobody is drawn hanging off the edge of the face.
  const usable = Math.max(0, half - SPRITE_W * 0.55);
  return {
    x: p.w / 2 + (c.lane - 0.5) * 2 * usable,
    y: worldY(cam, c.altitude) - cam.top,
  };
}

function fill(p: Painter, x: number, y: number, w: number, h: number, c: RGB) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) p.px(x + dx, y + dy, c);
}

/** Rotates a grid a quarter turn, for a mascot lying where it fell. */
export function rotateCW(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const out: string[] = [];
  for (let r = 0; r < w; r++) {
    let line = "";
    for (let c = 0; c < h; c++) line += rows[h - 1 - c][r];
    out.push(line);
  }
  return out;
}

function stampMascot(
  p: Painter,
  rows: string[],
  left: number,
  top: number,
  mascot: Mascot,
  jersey: string
) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const hex = colourFor(row[x], mascot, jersey);
      if (hex) p.px(left + x, top + y, rgb(hex));
    }
  });
}

function stampHazard(p: Painter, id: string, left: number, top: number) {
  const art = HAZARD_ART[id];
  if (!art) return;
  art.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const hex = hazardColour(row[x], art);
      if (hex) p.px(left + x, top + y, rgb(hex));
    }
  });
}

/**
 * Text with a dark halo around it.
 *
 * The halo is not decoration. A label on this mountain crosses white
 * snow, brown rock and night sky - often within the same three letters -
 * and any single ink colour disappears against one of them.
 */
function drawText(
  p: Painter,
  text: string,
  left: number,
  top: number,
  ink: RGB,
  halo: RGB = OUTLINE
) {
  eachTextPixel(text, (x, y) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        p.px(left + x + dx, top + y + dy, halo);
  });
  eachTextPixel(text, (x, y) => p.px(left + x, top + y, ink));
}

function drawTextCentred(
  p: Painter,
  text: string,
  cx: number,
  top: number,
  ink: RGB,
  halo?: RGB
) {
  drawText(p, text, Math.round(cx - textWidth(text) / 2), top, ink, halo);
}

/**
 * The mark that lands on whoever just went down.
 *
 * The card that follows says what happened, but the card arrives after
 * the fact and away from the mountain - without something appearing on
 * the mascot itself, a felling was a pick number materialising out of
 * nowhere while the pack carried on walking.
 */
const SKULL = [
  ".#####.",
  "#######",
  "##.#.##",
  "#######",
  ".#####.",
  ".#.#.#.",
  ".#####.",
];

function stampSkull(p: Painter, cx: number, top: number) {
  const bone = rgb("#f4f6f8");
  SKULL.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "#") continue;
      const px = Math.round(cx - row.length / 2) + x;
      // Outlined, so it reads on snow as well as on rock.
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) p.px(px + dx, top + y + dy, OUTLINE);
    }
  });
  SKULL.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") p.px(Math.round(cx - row.length / 2) + x, top + y, bone);
    }
  });
}

// --------------------------------------------------------- busted face

/**
 * The head that goes on the announcement card, with its eyes crossed
 * out and a scuff or two.
 *
 * Painted at the sprite's own resolution and scaled up by the canvas,
 * like everything else, so the Xs are drawn in the same pixels as the
 * face rather than as smooth strokes sitting on top of it.
 *
 * The eye positions come from `eyeClusters()`, which reads the `e`
 * pixels out of the art - so redrawing a head moves the Xs with it.
 */
export const CARD_W = 44;
export const CARD_H = 20;

/**
 * How much bigger the face is than the thing that got it.
 *
 * Back to life size now the heads are 24x18 rather than 16x10. Doubling
 * them was only ever propping up art that did not have the pixels; with
 * the real thing the face already fills more than half the card and the
 * hazard reads as the caption beside it.
 */
const FACE_SCALE = 1;

/**
 * The scene on the announcement card: who it happened to, and what did
 * it.
 *
 * This used to be the head alone, sixteen pixels across, floating in the
 * middle of a card with room for four times as much - so it read as a
 * small bad drawing rather than as a mascot that something had happened
 * to. Putting the hazard next to the face fills the space with the thing
 * the card is actually about, and at this size each source pixel lands
 * around nine across on screen, which is where the art starts looking
 * deliberate instead of merely low resolution.
 */
export function paintCardScene(
  p: Painter,
  mascot: Mascot,
  jersey: string,
  eyes: { x: number; y: number }[],
  hazardId: string | null,
  tick: number
) {
  const head = headRows(mascot);
  const headH = head.length * FACE_SCALE;
  const headTop = CARD_H - headH;

  // Drawn a pixel at a time at double size rather than by scaling the
  // canvas, so the hazard beside it can stay at its own scale.
  head.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const hex = colourFor(row[x], mascot, jersey);
      if (!hex) continue;
      const c = rgb(hex);
      for (let dy = 0; dy < FACE_SCALE; dy++)
        for (let dx = 0; dx < FACE_SCALE; dx++)
          p.px(x * FACE_SCALE + dx, headTop + y * FACE_SCALE + dy, c);
    }
  });

  const bruise = rgb("#8a2a1a");
  for (const eye of eyes) {
    // Centred on the middle of the scaled eye, and only a little wider
    // than the eye itself. Drawn six across from the eye's top-left
    // corner, the crosses spread over the whole head and read as a net
    // thrown over the mascot rather than as its eyes being crossed out.
    const ex = Math.round(eye.x * FACE_SCALE) + Math.floor(FACE_SCALE / 2);
    const ey =
      headTop + Math.round(eye.y * FACE_SCALE) + Math.floor(FACE_SCALE / 2);
    for (let d = -2; d <= 2; d++) {
      p.px(ex + d, ey + d, OUTLINE);
      p.px(ex + d, ey - d, OUTLINE);
    }
  }

  // Scuffs, so it reads as damage rather than as a mascot that happens
  // to have crosses where its eyes were.
  if (eyes.length) {
    const w = head[0]?.length ?? 0;
    const h = head.length;
    // Left at single-pixel size. Scaled up with the face they became
    // red slabs across every chin and read as injuries far worse than a
    // cartoon needs.
    for (let i = 0; i < 4; i++) {
      const x = Math.round(w * 0.2 + noise(i * 13, 3) * w * 0.6);
      const y = Math.round(h * 0.55 + noise(i * 7, 11) * h * 0.35);
      if (!colourFor(head[y]?.[x] ?? ".", mascot, jersey)) continue;
      p.px(x * FACE_SCALE, headTop + y * FACE_SCALE, bruise);
    }
  }

  if (hazardId) {
    const art = HAZARD_ART[hazardId];
    if (art) stampHazard(p, hazardId, CARD_W - 15, CARD_H - art.rows.length - 2);
    return;
  }

  // Nothing got the summiteer, so they get the flag instead.
  const fx = CARD_W - 10;
  fill(p, fx, 4, 1, CARD_H - 5, OUTLINE);
  for (let i = 0; i < 6; i++) fill(p, fx + 1, 4 + i, 8 - i, 1, FLAG);

  // A couple of sparks, so the winning card is not the only still one.
  const spark = rgb("#e8c02a");
  for (let i = 0; i < 4; i++) {
    const a = tick * 0.6 + i * 1.6;
    p.px(Math.round(fx - 4 + Math.cos(a) * 4), Math.round(8 + Math.sin(a) * 5), spark);
  }
}

// ---------------------------------------------------------------- sky

function paintSky(p: Painter, cam: Camera, seed: string) {
  for (let y = 0; y < p.h; y++) {
    const a = clamp01(altitudeAt(cam, cam.top + y) * 0.75 + 0.1);
    const band = mix(SKY_LOW, SKY_HIGH, a);
    for (let x = 0; x < p.w; x++) {
      // A touch of dither across the band so it does not look like a CSS
      // gradient that wandered into a pixel scene.
      p.px(x, y, dither(x, y) < 0.12 ? mix(band, SKY_HIGH, 0.35) : band);
    }
  }

  // Stars, fixed in world space so they scroll with the mountain rather
  // than sliding about behind it.
  const count = Math.round((p.w * cam.worldH) / 1400);
  for (let i = 0; i < count; i++) {
    const wx = Math.floor(unitFromSeed(`${seed}:sx:${i}`) * p.w);
    const wy = Math.floor(unitFromSeed(`${seed}:sy:${i}`) * cam.worldH);
    const y = wy - cam.top;
    if (y < 0 || y >= p.h) continue;
    // Thinner air, more stars: the low sky keeps only the bright ones.
    const a = clamp01(altitudeAt(cam, wy));
    if (unitFromSeed(`${seed}:st:${i}`) > 0.25 + a * 0.75) continue;
    p.px(wx, y, STAR);
  }
}

// ----------------------------------------------------------- mountain

/**
 * Ridges standing behind the mountain being climbed.
 *
 * Without them the main face was a shape on a flat sky and did not read
 * as a mountain at all - there was nothing to say it was a long way up
 * rather than a brown triangle. These sit further away, in a colder
 * colour, and do not scroll at quite the same rate as the foreground.
 */
function paintRidges(p: Painter, cam: Camera) {
  const far = mix(SKY_LOW, SNOW_SHADE, 0.3);
  const near = mix(SKY_LOW, SNOW_SHADE, 0.46);

  const peaks = [
    { x: 0.14, top: 0.44, w: 0.3, c: far, drift: 0.18 },
    { x: 0.86, top: 0.38, w: 0.34, c: far, drift: 0.18 },
    { x: 0.34, top: 0.6, w: 0.26, c: near, drift: 0.3 },
    { x: 0.7, top: 0.66, w: 0.24, c: near, drift: 0.3 },
  ];

  // Anchored to the screen with a slow drift, not to the world.
  //
  // Pinned to world coordinates - which was the obvious thing to do -
  // they sat a couple of screens below the viewport for the entire climb
  // and never drew a single pixel. What is wanted is a horizon: hidden
  // behind the face near the bottom, rising into view as the camera
  // climbs and there is further to see.
  const progress = 1 - cam.top / Math.max(1, cam.worldH - p.h);

  for (const peak of peaks) {
    const baseY = p.h * (1.08 - peak.drift * progress);
    const apexY = baseY - p.h * peak.top;
    const apexX = p.w * peak.x;
    const halfBase = p.w * peak.w;

    for (let y = Math.max(0, Math.round(apexY)); y < Math.min(p.h, baseY); y++) {
      const down = (y - apexY) / Math.max(1, baseY - apexY);
      const half = halfBase * down;
      for (let x = Math.round(apexX - half); x <= Math.round(apexX + half); x++) {
        if (x < 0 || x >= p.w) continue;
        // A dusting of snow on the far tops, so they read as mountains
        // rather than as blue hills.
        const capped = down < 0.22 && dither(x, y) < 0.55;
        p.px(x, y, capped ? mix(peak.c, SNOW, 0.5) : peak.c);
      }
    }
  }
}

/**
 * A switchback path zigzagging up the face.
 *
 * The single clearest signal that this is a climb. Twelve mascots
 * standing on a slope look like twelve mascots standing on a slope; put
 * a trail under them and they are walking up it.
 */
function paintTrail(p: Painter, cam: Camera) {
  const cx = p.w / 2;
  const ink = mix(ROCK_SHADE, OUTLINE, 0.35);

  for (let y = 0; y < p.h; y++) {
    const wy = cam.top + y;
    const a = altitudeAt(cam, wy);
    if (a < 0 || a > 1) continue;
    const half = halfWidth(p.w, a);
    // Fewer, wider sweeps low down where the mountain is broad; tighter
    // as it narrows, so the switchbacks stay in proportion.
    const sweep = Math.sin(a * Math.PI * 7) * (half - 6) * 0.72;
    const tx = Math.round(cx + sweep);
    // Dashed, so it reads as a path rather than as a drawn line.
    if ((wy >> 1) % 3 === 0) continue;
    p.px(tx, y, ink);
    p.px(tx + 1, y, ink);
  }
}

function paintMountain(p: Painter, cam: Camera) {
  const cx = p.w / 2;

  for (let y = 0; y < p.h; y++) {
    const wy = cam.top + y;
    const a = altitudeAt(cam, wy);
    if (a > 1) continue; // above the peak: sky

    // Below the trailhead the mountain flares out into the ground, so
    // its base sits on something rather than floating. Widening rather
    // than jumping straight to full width: the jump put a hard step in
    // the silhouette and the whole thing read as a mesa.
    const half = a < 0 ? halfWidth(p.w, 0) + -a * p.w * 3 : halfWidth(p.w, a);
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);

    for (let x = Math.max(0, left); x <= Math.min(p.w - 1, right); x++) {
      const edge = x <= left + 1 || x >= right - 1;

      // Snow above, rock below, dithered through the middle so the snow
      // line is a scatter rather than a ruled line. The band is narrow:
      // spread over a third of the mountain it stopped reading as a snow
      // line at all and became a checkerboard swatch pasted across the
      // middle of the shot.
      // The noise moves the snow *line*, inside the clamp. Added to the
      // clamped result instead it lifted a snowiness of zero above the
      // dither threshold, and flung snow pixels down the bare rock all
      // the way to the trailhead.
      const snowiness = clamp01((a - 0.3 + (noise(x, wy) - 0.5) * 0.07) / 0.18);
      const snowy = dither(x, y) < snowiness;

      // The face is lit from the left, so the right-hand side drops into
      // shade and the mountain reads as a solid rather than a cut-out.
      // Dithered across a span rather than switched at a threshold - a
      // threshold put a hard vertical seam down the whole mountain that
      // looked like two images butted together.
      const across = (x - (cx - half)) / Math.max(1, half * 2);
      const shaded =
        dither(x, y) <
        clamp01((across - 0.5 + (noise(x, wy) - 0.5) * 0.12) / 0.28);

      let c: RGB;
      if (edge && a >= 0) c = OUTLINE;
      else if (snowy) c = shaded ? SNOW_SHADE : SNOW;
      else c = shaded ? ROCK_SHADE : ROCK;

      // Speckle, so large flat areas have some tooth to them.
      if (!edge && noise(x + 31, wy + 17) > 0.965) c = mix(c, OUTLINE, 0.22);
      p.px(x, y, c);
    }
  }
}

function paintSummitFlag(p: Painter, cam: Camera) {
  const x = Math.round(p.w / 2);
  const y = Math.round(worldY(cam, 1) - cam.top);
  if (y < -20 || y > p.h + 20) return;
  fill(p, x, y - 16, 1, 16, OUTLINE);
  for (let i = 0; i < 5; i++) fill(p, x + 1, y - 16 + i, 6 - i, 1, FLAG);
}

// ---------------------------------------------------------- climbers

export interface PaintTeam {
  mascot: Mascot;
  /** The team's colour, worn on the jersey. */
  jersey: string;
  /** Three letters, carried up the mountain under the mascot. */
  label: string;
}

export interface PaintOptions {
  scene: ClimbScene;
  teams: Map<string, PaintTeam>;
  seed: string;
  /** Advances the leg frames and the bob. */
  tick: number;
  /** Overrides the camera, for the walk-up between fellings. */
  packAltitude?: number;
  /** Gets a marker over its head, so you can find yourself in the pack. */
  highlightTeamId?: string | null;
  /**
   * Whitens the whole frame, 0 to 1 - the lightning that goes with a
   * felling. Dithered rather than blended, because this is an eight-bit
   * screen and a smooth white wash over it looks like a bug.
   */
  flash?: number;
  /** Wears a skull: the mascot that has just this moment gone down. */
  strikeTeamId?: string | null;
}

export function paintClimb(p: Painter, opts: PaintOptions) {
  const { scene, teams, seed, tick } = opts;
  const packAltitude = opts.packAltitude ?? scene.packAltitude;
  const cam = camera(p.h, packAltitude);

  paintSky(p, cam, seed);
  paintRidges(p, cam);
  paintMountain(p, cam);
  paintTrail(p, cam);
  paintSummitFlag(p, cam);

  // Lower down the mountain first, so a climber higher up overlaps the
  // one below rather than being cut into by them.
  const order = [...scene.climbers].sort((a, b) => a.altitude - b.altitude);

  order.forEach((c) => {
    const team = teams.get(c.teamId);
    if (!team) return;

    const climbing = c.status === "climbing";
    const at = climberXY(p, cam, {
      ...c,
      altitude: climbing ? packAltitude + (c.altitude - scene.packAltitude) : c.altitude,
    });
    if (at.y < -40 || at.y > p.h + 40) return;

    const left = Math.round(at.x - SPRITE_W / 2);

    if (climbing) {
      // Feet on the altitude line, with a bob so a paused pack still
      // looks like it is working at the hill.
      const frame = ((tick + Math.round(c.lane * 7)) % 2) as 0 | 1;
      const bob = Math.round(Math.sin((tick + c.lane * 9) * 0.6)) === 1 ? 1 : 0;
      const top = Math.round(at.y) - SPRITE_H + bob;
      stampMascot(p, spriteRows(team.mascot, frame), left, top, team.mascot, team.jersey);

      // The name goes under the feet. Twelve mascots at sixteen pixels
      // across cannot be told apart by jersey colour from a sofa, and
      // "which one is mine" was the first thing anyone asked.
      //
      // Three rows, by lane. On one row the twelve labels overlapped
      // into an unreadable ribbon along the bottom of the mountain,
      // which is worse than no labels at all; two rows still collided
      // where the lane jitter put neighbours close together.
      const tier = [2, 8, 14][Math.round(c.lane * 11) % 3];
      drawTextCentred(p, team.label, at.x, Math.round(at.y) + tier, rgb(team.jersey));

      // Twelve mascots on a mountain and one of them is yours. Without a
      // marker the honest answer to "which one am I" is the jersey
      // colour, at sixteen pixels, from a sofa.
      if (opts.highlightTeamId && c.teamId === opts.highlightTeamId) {
        const mx = Math.round(at.x);
        const my = top - 4 - (tick % 2);
        for (let i = 0; i < 3; i++) fill(p, mx - i, my - i, i * 2 + 1, 1, FLAG);
      }
      return;
    }

    if (c.status === "summited") {
      stampMascot(
        p,
        spriteRows(team.mascot, (tick % 2) as 0 | 1),
        left,
        Math.round(at.y) - SPRITE_H,
        team.mascot,
        team.jersey
      );
      return;
    }

    // Felled: lying where they went down, with whatever did it.
    const art = c.hazard ? HAZARD_ART[c.hazard.id] : undefined;
    const lying = rotateCW(spriteRows(team.mascot, 0));
    const lyingW = lying[0]?.length ?? 0;
    const lyingH = lying.length;
    const bodyLeft = Math.round(at.x - lyingW / 2);
    const bodyTop = Math.round(at.y) - lyingH;

    const hazardLeft = Math.round(at.x - 7);
    const hazardTop = Math.round(at.y) - (art?.rows.length ?? 0);

    if (art?.behind) {
      stampHazard(p, c.hazard!.id, hazardLeft, hazardTop);
      stampMascot(p, lying, bodyLeft, bodyTop, team.mascot, team.jersey);
    } else {
      stampMascot(p, lying, bodyLeft, bodyTop, team.mascot, team.jersey);
      if (c.hazard) stampHazard(p, c.hazard.id, hazardLeft, hazardTop - 2);
    }

    // The one that has just gone down wears a skull, floating and
    // bobbing, until the card takes over.
    if (opts.strikeTeamId === c.teamId) {
      stampSkull(p, at.x, bodyTop - 12 - (tick % 2) * 2);
    }
  });

  // The lightning, over everything.
  const flash = opts.flash ?? 0;
  if (flash > 0) {
    const white = rgb("#ffffff");
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++)
        if (dither(x, y) < flash) p.px(x, y, white);
  }

  // The mountain's name, on the mountain.
  //
  // It was an HTML heading above the canvas, which explained the
  // reference before anyone had seen the thing it refers to. Inside the
  // picture it is a sign at the trailhead instead of a caption.
  drawTextCentred(p, "BIJAN GIBBS MOUNTAIN", p.w / 2, 4, rgb("#e8a33d"));
}
