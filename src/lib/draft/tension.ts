/**
 * How agitated the front door should be, given how close the draft is.
 *
 * The poster starts almost still and works itself up: a twitch every few
 * seconds days out, a flicker the night before, and something close to a
 * malfunctioning arcade cabinet in the last hour. The point is that
 * somebody who opens the link on Wednesday and again on Saturday should
 * feel the difference without being told there is one.
 *
 * The curve is deliberately steep. A linear ramp over ten days spends
 * most of its range on days nobody is looking - by the afternoon of the
 * draft it would already be at full tilt with hours still to go, leaving
 * nowhere to build to. Raising it to the fifth keeps almost all of the
 * movement in the final day, which is where the anticipation actually
 * lives.
 */

/** How long before the draft the poster starts stirring at all. */
export const TENSION_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

const CURVE = 5;

/** 0 = still, 1 = the draft is here. */
export function tensionAt(nowMs: number, targetMs: number): number {
  const remaining = targetMs - nowMs;
  if (remaining <= 0) return 1;
  if (remaining >= TENSION_WINDOW_MS) return 0;

  const progress = 1 - remaining / TENSION_WINDOW_MS;
  return Math.pow(progress, CURVE);
}

/**
 * The number of discrete steps the visuals come in.
 *
 * Buckets rather than a continuous value fed into CSS, because a
 * crescendo made of five distinct gears is indistinguishable from a
 * smooth one at these timescales, and it means every effect is a plain
 * class with fixed numbers - readable, previewable, and impossible to
 * get subtly wrong in a `calc()` nobody can inspect.
 */
export const CHAOS_LEVELS = 5;

/**
 * Where each gear engages.
 *
 * Spaced by when they land in real time rather than by even steps up the
 * curve - see the pacing test, which pins the arrival of each one. The
 * top gear is deliberately hard to reach: at 0.85 it engaged at ten on
 * Saturday morning and ran flat out for seven hours, which is both
 * exhausting and spends the loudest thing on the page long before anyone
 * is watching. It now arrives with a couple of hours to go.
 */
const THRESHOLDS = [0.15, 0.35, 0.62, 0.95];

export function chaosLevel(tension: number): number {
  let level = 0;
  for (const threshold of THRESHOLDS) {
    if (tension >= threshold) level++;
  }
  return level;
}

/** What each gear is called, for the preview readout. */
export const LEVEL_NAMES = [
  "still",
  "stirring",
  "restless",
  "agitated",
  "critical",
] as const;

/**
 * How often the beeping fires at each level, in milliseconds. Silent at
 * rest, and never faster than a beep a second - past that it stops
 * reading as tension and starts reading as a fire alarm.
 */
export const BEEP_INTERVAL_MS = [0, 25000, 11000, 4500, 1600] as const;
