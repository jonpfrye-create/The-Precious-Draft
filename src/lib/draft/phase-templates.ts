export type PhaseType = "main" | "leftovers" | "microwave";

export interface SlotTemplate {
  slotName: string;
  eligiblePositions: string[];
  isBench: boolean;
}

export const FLEX_POSITIONS = ["RB", "WR", "TE"];
export const ALL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export const PHASE_SEQUENCE: PhaseType[] = ["main", "leftovers", "microwave"];

export const PHASE_LABELS: Record<PhaseType, string> = {
  main: "Main",
  leftovers: "Leftovers",
  microwave: "Microwave",
};

/** The phase that comes after this one, or null after Microwave. */
export function nextPhaseType(current: PhaseType): PhaseType | null {
  const index = PHASE_SEQUENCE.indexOf(current);
  if (index === -1 || index === PHASE_SEQUENCE.length - 1) return null;
  return PHASE_SEQUENCE[index + 1];
}

/**
 * Leftovers' roster: the previous phase's starters, plus a kicker.
 *
 * Derived from Main rather than hardcoded so that changing Main's shape in
 * a future season carries through automatically. Bench slots are dropped -
 * Leftovers is starters only - and a K slot is appended if there isn't one,
 * which there won't be, because this league doesn't start a kicker in Main.
 * That's the round that makes kickers matter.
 */
export function leftoversTemplate(
  previousSlots: readonly SlotTemplate[]
): SlotTemplate[] {
  const starters = previousSlots
    .filter((slot) => !slot.isBench)
    .map((slot) => ({ ...slot }));

  const hasKicker = starters.some(
    (slot) =>
      slot.eligiblePositions.length === 1 && slot.eligiblePositions[0] === "K"
  );
  if (!hasKicker) {
    starters.push({
      slotName: "K",
      eligiblePositions: ["K"],
      isBench: false,
    });
  }
  return starters;
}

/**
 * Microwave: exactly two picks, both flex-eligible. Running backs,
 * receivers and tight ends only - no quarterbacks, kickers or defenses at
 * either slot, including the bench one.
 *
 * Fixed rather than derived, because it bears no relation to the phases
 * before it.
 */
export function microwaveTemplate(): SlotTemplate[] {
  return [
    { slotName: "W/R/T", eligiblePositions: [...FLEX_POSITIONS], isBench: false },
    { slotName: "BENCH", eligiblePositions: [...FLEX_POSITIONS], isBench: true },
  ];
}

export function templateForPhase(
  type: PhaseType,
  previousSlots: readonly SlotTemplate[]
): SlotTemplate[] {
  if (type === "microwave") return microwaveTemplate();
  if (type === "leftovers") return leftoversTemplate(previousSlots);
  // Main is built by hand at league setup; there's nothing before it to
  // derive from.
  return previousSlots.map((slot) => ({ ...slot }));
}
