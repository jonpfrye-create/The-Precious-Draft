import { unitFromSeed } from "@/lib/random/seeded";
import type { ClimbScene, Climber } from "./climb";
import { HAZARD_ART, hazardColour } from "./hazard-art";
import {
  colourFor,
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
export function paintBustedFace(
  p: Painter,
  mascot: Mascot,
  jersey: string,
  eyes: { x: number; y: number }[]
) {
  stampMascot(p, mascot.head, 0, 0, mascot, jersey);

  const bruise = rgb("#8a2a1a");
  for (const eye of eyes) {
    const cx = Math.round(eye.x);
    const cy = Math.round(eye.y);
    for (let d = -1; d <= 1; d++) {
      p.px(cx + d, cy + d, OUTLINE);
      p.px(cx + d, cy - d, OUTLINE);
    }
  }

  // A couple of scuffs, so it reads as damage rather than as a mascot
  // that happens to have Xs where its eyes were.
  const w = mascot.head[0]?.length ?? 0;
  const h = mascot.head.length;
  for (let i = 0; i < 5; i++) {
    const x = Math.round(w * 0.2 + noise(i * 13, 3) * w * 0.6);
    const y = Math.round(h * 0.55 + noise(i * 7, 11) * h * 0.35);
    if (colourFor(mascot.head[y]?.[x] ?? ".", mascot, jersey)) p.px(x, y, bruise);
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
}

export function paintClimb(p: Painter, opts: PaintOptions) {
  const { scene, teams, seed, tick } = opts;
  const packAltitude = opts.packAltitude ?? scene.packAltitude;
  const cam = camera(p.h, packAltitude);

  paintSky(p, cam, seed);
  paintMountain(p, cam);
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
  });
}
