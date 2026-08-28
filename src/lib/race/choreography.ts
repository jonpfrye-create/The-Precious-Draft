import { rangeFromSeed, unitFromSeed } from "@/lib/random/seeded";

/**
 * The mascot race: twelve identical mascots in twelve liveries, running
 * for the draft order. The one that breaks the tape picks first.
 *
 * The result is decided before a single frame is drawn. The order comes
 * from the server's shuffle, sealed in the database and timestamped, and
 * this only choreographs a race that arrives at it - the same way the
 * sausages at Miller Park are not deciding anything either. That is the
 * point rather than a compromise: the outcome is provably committed
 * before the show starts, so the show can be as dramatic as it likes
 * without anyone wondering whether it was steered.
 *
 * Everything here is derived from a seed rather than from Math.random,
 * because twelve phones and a television have to watch the *same* race.
 * A runner who leads on the TV and trails on your phone is worse than no
 * race at all.
 */

export type Runner = {
  teamId: string;
  /** 0 = wins the race and picks first. */
  finishRank: number;
  /** How far down the track, 0 at the line, 1 at the tape. */
  distance: number;
  /** Live placing at this instant, 0-based. Not the finish rank. */
  place: number;
};

export type Lane = {
  teamId: string;
  finishRank: number;
  /** When this runner breaks the tape, as a fraction of the race. */
  finishAt: number;
  /** Size, speed and phase of this runner's surges. */
  surge: number;
  tempo: number;
  phase: number;
};

/**
 * How much later the last-placed mascot finishes than the winner. Small
 * on purpose - a race decided by daylight is over in the first second,
 * and this one has to stay worth watching for its whole length.
 */
const SPREAD = 0.16;

/**
 * How far a runner can drift from the pack mid-race.
 *
 * Generous, because this is watched from across a room on a television.
 * At 0.085 the twelve of them stayed inside a thumb's width of track and
 * the lead changes were real but invisible.
 */
const MAX_SURGE = 0.14;

/**
 * Builds one lane per team from the finish order.
 *
 * `finishOrder` is the drawn draft order: index 0 picks first, and so
 * wins. The seed should be something already fixed and shared - the
 * phase id - so every screen choreographs the identical race without
 * having to send a single frame between them.
 */
export function buildLanes(finishOrder: string[], seed: string): Lane[] {
  const count = finishOrder.length;

  return finishOrder.map((teamId, finishRank) => {
    const key = `${seed}:${teamId}`;
    return {
      teamId,
      finishRank,
      // Evenly spaced finishes, nudged so the gaps are not identical.
      finishAt:
        1 +
        (finishRank / Math.max(1, count - 1)) * SPREAD +
        rangeFromSeed(`${key}:stagger`, -0.012, 0.012),
      surge: rangeFromSeed(`${key}:surge`, 0.35, 1) * MAX_SURGE,
      tempo: rangeFromSeed(`${key}:tempo`, 1.4, 3.2),
      phase: unitFromSeed(`${key}:phase`) * Math.PI * 2,
    };
  });
}

/** Smooth start, hard finish - a sprint, not a constant crawl. */
function ease(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Where every runner is at time `t`, where t is 0 at the gun and 1 when
 * the winner breaks the tape.
 *
 * The surges that make the race worth watching are damped as the runners
 * approach the line, so the order at the tape is exactly the order that
 * was drawn. Wobble that survived to the finish would be a race that
 * decides its own result, which is the one thing this must never do.
 */
export function raceAt(lanes: Lane[], t: number): Runner[] {
  const runners = lanes.map((lane) => {
    const base = ease(t / lane.finishAt);

    // Zero at both ends and widest in the middle. Zero at the tape means
    // nothing can reorder the finish; zero at the gun means nobody is
    // standing ahead of the line before the race has started, which is
    // what the first version did - the surge was only damped at the
    // finish, so half the field began a stride up the track.
    //
    // base * (1 - base)^2 peaks at 0.148, so the scale brings the widest
    // point back to a full surge.
    const damping = Math.min(1, 6.75 * base * (1 - base) ** 2);
    const wobble =
      Math.sin(t * lane.tempo * Math.PI * 2 + lane.phase) * lane.surge * damping;

    return {
      teamId: lane.teamId,
      finishRank: lane.finishRank,
      distance: Math.min(1, Math.max(0, base + wobble)),
      place: 0,
    };
  });

  // Live placing, which is what the position markers on screen show. Ties
  // break on finish rank so the board never flickers between two runners
  // sitting on the same pixel.
  [...runners]
    .sort((a, b) =>
      b.distance !== a.distance
        ? b.distance - a.distance
        : a.finishRank - b.finishRank
    )
    .forEach((runner, index) => {
      runner.place = index;
    });

  return runners;
}

/**
 * How long the whole field takes to finish, as a multiple of the
 * winner's time - so the renderer knows when to stop rather than cutting
 * away while the back half is still running.
 */
export function raceLength(lanes: Lane[]): number {
  return Math.max(...lanes.map((lane) => lane.finishAt));
}
