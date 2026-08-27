/**
 * How agitated the front door should be, given how close the draft is.
 *
 * The poster spends days barely stirring and then loses its composure in
 * the last half hour: restless at half past, knocking at ten to, and
 * something close to a failing arcade cabinet with two minutes left.
 *
 * Gears are defined by **when they engage**, not by a curve with
 * thresholds. An earlier version derived them from a power curve and the
 * numbers in it said nothing useful - 0.62 gives no hint that it means
 * Friday evening, and getting the top gear to land where it should meant
 * solving backwards through an exponent. Minutes-before-the-draft is the
 * thing actually being chosen, so it is the thing written down.
 */

/** How long before the draft each gear engages, in minutes. */
export const GEAR_MINUTES_OUT = [
  Number.POSITIVE_INFINITY, // 0 - still, until the poster is worth watching
  3 * 24 * 60, // 1 - stirring, three days out
  30, // 2 - restless
  10, // 3 - agitated
  2, // 4 - critical
] as const;

export const CHAOS_LEVELS = GEAR_MINUTES_OUT.length;

/** What each gear is called, for the preview readout. */
export const LEVEL_NAMES = [
  "still",
  "stirring",
  "restless",
  "agitated",
  "critical",
] as const;

/**
 * How often the beeping fires at each gear, in milliseconds.
 *
 * Silent for the first two. Beeping at somebody for three days is not
 * tension, it is a smoke alarm with a flat battery - the sound only has
 * anything to say once the last half hour starts.
 */
export const BEEP_INTERVAL_MS = [0, 0, 6000, 2500, 900] as const;

const MINUTE = 60_000;

/** Which gear the poster is in. 0 = still, 4 = critical. */
export function chaosLevelAt(nowMs: number, targetMs: number): number {
  const minutesOut = (targetMs - nowMs) / MINUTE;

  let level = 0;
  for (let i = 1; i < GEAR_MINUTES_OUT.length; i++) {
    if (minutesOut <= GEAR_MINUTES_OUT[i]) level = i;
  }
  return level;
}

/**
 * A 0..1 reading of the same thing, for the beep's pitch.
 *
 * Derived from the gear rather than from the clock so the sound and the
 * picture can never describe different moments.
 */
export function pitchForLevel(level: number): number {
  return level / (CHAOS_LEVELS - 1);
}
