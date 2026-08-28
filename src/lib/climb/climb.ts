import { rangeFromSeed, hashString } from "@/lib/random/seeded";

/**
 * The climb up Bijan Gibbs Mountain.
 *
 * Twelve mascots set off for the summit and are picked off one at a time
 * on the way up. Each one that goes down is a draft position announced,
 * counting backwards - the first to fall picks last, and whoever is left
 * standing on the summit picks first.
 *
 * This is a *rendering of the reveal that already exists*, not a new
 * mechanism. `nextRevealStep()` in order-draw.ts has always turned over
 * position N first and position 1 last, with `isFinale` on position 1;
 * one press of the commissioner's button is one mascot felled. The draw,
 * the reveal, the realtime and the RLS are all untouched - which matters,
 * because they are the highest-risk code in the project and it is two
 * days to draft day.
 *
 * ## Why this takes the team list and the fellings separately
 *
 * It would be far simpler to hand this the drawn order and let it work
 * out who is still climbing. That would also put the entire draft order
 * into twelve browsers before a single slot had been turned over, which
 * is exactly the leak that was found in /draft in August - the reveal
 * gating is worthless if the data ships anyway.
 *
 * So the split is deliberate and load-bearing:
 *
 *   - `teams` is the whole field, and is *already public*. The waiting
 *     room lists all twelve names before anything is drawn.
 *   - `fellings` carries only positions the commissioner has actually
 *     turned over.
 *
 * Everyone on the mountain is therefore drawable from the start - you can
 * find your own mascot and shout at it - while the thing being revealed
 * stays revealed one press at a time. There is a test asserting that no
 * unrevealed position can be recovered from the scene.
 *
 * ## Why there is no animation state in here
 *
 * The mascot race this replaces tried to run a sixteen-second animation
 * that twelve phones and a television had to agree on, frame for frame,
 * having agreed on nothing but a seed. It was as buggy as that sounds.
 *
 * The climb is a pure function of the revealed count. It is *paused*
 * almost all of the time, and it advances only when a felling arrives -
 * which is the one thing the reveal is already good at delivering. Two
 * screens can be a second apart and still be showing the same picture.
 */

export interface Hazard {
  id: string;
  /** Shown on the announcement card. */
  label: string;
}

/**
 * What can go wrong on the mountain.
 *
 * Ordered as authored; the running order on the night is a seeded
 * shuffle, so no two leagues get the same sequence of disasters.
 */
export const HAZARDS: readonly Hazard[] = [
  { id: "boulder", label: "FLATTENED BY A BOULDER" },
  { id: "chasm", label: "LOST TO THE CHASM" },
  { id: "bear", label: "MAULED BY A BEAR" },
  { id: "beartrap", label: "CAUGHT IN A BEAR TRAP" },
  { id: "rope", label: "THE ROPE SNAPPED" },
  { id: "eagle", label: "CARRIED OFF BY AN EAGLE" },
  { id: "crevasse", label: "SWALLOWED BY A CREVASSE" },
  { id: "ice", label: "SLIPPED ON THE ICE" },
] as const;

/**
 * The yeti is not in the shuffle.
 *
 * SkiFree's yeti is the whole reason anyone remembers SkiFree, so it is
 * spent on the one felling that is worth spending it on: the last one
 * before the summit - the team that came within a single place of the
 * first pick and got eaten instead.
 */
export const YETI: Hazard = { id: "yeti", label: "EATEN BY THE YETI" };

export interface ClimbTeam {
  teamId: string;
  name: string;
  hex: string;
}

/** A draft position the commissioner has turned over. */
export interface Felling {
  /** Counts down: the field size first, 1 last. */
  position: number;
  teamId: string;
}

export type ClimberStatus = "climbing" | "felled" | "summited";

export interface Climber {
  teamId: string;
  status: ClimberStatus;
  /** 0 at the trailhead, 1 at the summit. */
  altitude: number;
  /** Across the mountain face, 0 at the left edge and 1 at the right. */
  lane: number;
  /** Only ever set once this climber's slot has been turned over. */
  position: number | null;
  /** Which felling this was, 1-based. Null while still climbing. */
  step: number | null;
  /** What got them. Null while climbing, and null for the summiteer. */
  hazard: Hazard | null;
}

export interface ClimbScene {
  climbers: Climber[];
  /** How far up the survivors have got. The camera follows this. */
  packAltitude: number;
  /** The climber the most recent press accounted for, for the card. */
  latest: Climber | null;
  /** Every position turned over: somebody is stood on the summit. */
  complete: boolean;
  fieldSize: number;
}

/**
 * How far apart the pack drifts, up-mountain and across.
 *
 * Small. They are climbing together and being picked off, not racing -
 * spreading them out would invent a leader, and a leader implies the
 * order is being decided on screen when it was decided by the server's
 * shuffle before anyone sat down.
 *
 * The up-mountain figure is a fraction of the gap between two fellings
 * rather than a flat number, and comfortably under half of it, so two
 * mascots felled one after the other can never swap places however big
 * the field gets. At a flat 0.022 that held for twelve by luck and would
 * have quietly stopped holding somewhere north of twenty - the fallen
 * are meant to read as a trail up the mountain, in the order they went
 * down.
 */
const ALTITUDE_JITTER_SHARE = 0.4;
const LANE_JITTER = 0.03;

/** Which felling turns over a given draft position. */
export function stepForPosition(fieldSize: number, position: number): number {
  return fieldSize - position + 1;
}

/** How far up the mountain the k-th felling happens. */
export function altitudeForStep(fieldSize: number, step: number): number {
  if (fieldSize < 1) return 0;
  return Math.min(1, Math.max(0, step / fieldSize));
}

/**
 * The running order of disasters, seeded so every screen shows the same
 * one and no two leagues get the same sequence.
 */
export function hazardOrder(seed: string): Hazard[] {
  return [...HAZARDS].sort(
    (a, b) => hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`)
  );
}

function hazardForStep(
  fieldSize: number,
  step: number,
  seed: string
): Hazard | null {
  // The summit is not a hazard. Whoever is left has simply arrived.
  if (step >= fieldSize) return null;
  if (step === fieldSize - 1) return YETI;

  const order = hazardOrder(seed);
  // Cycled rather than sampled, so all eight are seen and the same one
  // never lands twice in a row.
  return order[(step - 1) % order.length];
}

/**
 * Where everyone is, given how many slots have been turned over.
 *
 * `fellings` may arrive in any order; the step each one represents is
 * derived from its draft position rather than its place in the array, so
 * a reordered list cannot shuffle the disasters.
 */
export function climbScene(
  teams: ClimbTeam[],
  fellings: Felling[],
  seed: string
): ClimbScene {
  const fieldSize = teams.length;
  const revealed = new Map(fellings.map((f) => [f.teamId, f.position]));
  const packAltitude = altitudeForStep(fieldSize, fellings.length);

  // Lanes are spread evenly and then jittered, rather than drawn at
  // random, so nobody spends the whole climb hidden behind somebody else.
  const byLane = [...teams].sort(
    (a, b) =>
      hashString(`${seed}:lane:${a.teamId}`) -
      hashString(`${seed}:lane:${b.teamId}`)
  );
  const laneOf = new Map(
    byLane.map((t, i) => [
      t.teamId,
      Math.min(
        1,
        Math.max(
          0,
          (i + 0.5) / Math.max(1, fieldSize) +
            rangeFromSeed(`${seed}:lanejit:${t.teamId}`, -LANE_JITTER, LANE_JITTER)
        )
      ),
    ])
  );

  const jitter = ALTITUDE_JITTER_SHARE / Math.max(1, fieldSize);

  const climbers: Climber[] = teams.map((team) => {
    const position = revealed.get(team.teamId) ?? null;
    const lane = laneOf.get(team.teamId) ?? 0.5;
    const wobble = rangeFromSeed(`${seed}:alt:${team.teamId}`, -jitter, jitter);

    if (position === null) {
      return {
        teamId: team.teamId,
        status: "climbing" as const,
        altitude: Math.max(0, packAltitude + wobble),
        lane,
        position: null,
        step: null,
        hazard: null,
      };
    }

    const step = stepForPosition(fieldSize, position);
    const summited = position === 1;

    return {
      teamId: team.teamId,
      status: summited ? ("summited" as const) : ("felled" as const),
      // The summiteer stands on the top, dead centre, not off in a lane.
      altitude: summited ? 1 : Math.max(0, altitudeForStep(fieldSize, step) + wobble),
      lane: summited ? 0.5 : lane,
      position,
      step,
      hazard: hazardForStep(fieldSize, step, seed),
    };
  });

  const latest =
    climbers
      .filter((c) => c.step !== null)
      .sort((a, b) => (b.step ?? 0) - (a.step ?? 0))[0] ?? null;

  return {
    climbers,
    packAltitude,
    latest,
    complete: fieldSize > 0 && fellings.length >= fieldSize,
    fieldSize,
  };
}

/**
 * How the pick number reads on the card - "1ST PICK", "12TH PICK".
 *
 * Spelled out here rather than in the component because the card and the
 * summit banner both need it and they must not disagree.
 */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}TH`;
  switch (n % 10) {
    case 1:
      return `${n}ST`;
    case 2:
      return `${n}ND`;
    case 3:
      return `${n}RD`;
    default:
      return `${n}TH`;
  }
}
