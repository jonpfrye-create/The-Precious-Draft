import { assignRoster, type SlotSpec } from "./roster-fit";

/**
 * A slot plus whether it's a bench slot.
 *
 * SlotSpec deliberately stops at what matching needs, and matching does
 * not care about the bench - a bench slot is just one that accepts every
 * position, and that falls out of eligiblePositions on its own. Starter
 * versus bench only matters for describing a roster to a reader, so it
 * gets added here rather than pushed back into the matching type.
 */
export interface ScoutingSlot extends SlotSpec {
  isBench?: boolean;
}

/**
 * Turning a drafted roster into the facts a grader actually argues from.
 *
 * This exists so that no model ever does arithmetic. "He reached four
 * rounds for a kicker" is a claim that has to be true, and a language
 * model asked to subtract ADP from pick number will be confidently wrong
 * often enough to embarrass the whole trick. Everything numeric is
 * computed here, tested here, and handed over already stated.
 */

export interface ScoutedPlayer {
  fullName: string;
  position: string | null;
  nflTeam: string | null;
  adp: number | null;
}

export interface ScoutedPickInput {
  pickNumber: number;
  round: number;
  player: ScoutedPlayer;
}

export interface ScoutedPick {
  pickNumber: number;
  round: number;
  fullName: string;
  position: string | null;
  nflTeam: string | null;
  adp: number | null;
  /**
   * How far off the market this pick was, in picks. Positive means taken
   * earlier than ADP (a reach), negative means later (value). Null when
   * the player has no ADP at all - the sharpie players, who by definition
   * nobody expected to be drafted, so there is no market to be off.
   */
  vsAdp: number | null;
  /** Starting slot, bench slot, or null if they didn't fit anywhere. */
  slot: string | null;
  isStarter: boolean;
}

export interface ScoutingReport {
  teamName: string;
  draftPosition: number | null;
  picks: ScoutedPick[];
  /** Count by position, e.g. { RB: 3, WR: 4, QB: 1 }. */
  byPosition: Record<string, number>;
  /** Picks taken furthest ahead of ADP, worst reach first. */
  reaches: ScoutedPick[];
  /** Picks taken furthest behind ADP, best value first. */
  values: ScoutedPick[];
  /** Players with no ADP - undrafted by the wider market. */
  offTheBoard: ScoutedPick[];
  /**
   * Mean vsAdp across picks that have an ADP. A positive number is a team
   * that consistently reached. Null when no pick had an ADP.
   */
  averageVsAdp: number | null;
}

/** Anything this far ahead of ADP is worth a grader's attention. */
export const NOTABLE_REACH = 12;

export function scoutTeam(
  teamName: string,
  draftPosition: number | null,
  picks: readonly ScoutedPickInput[],
  slots: readonly ScoutingSlot[]
): ScoutingReport {
  const inPickOrder = [...picks].sort((a, b) => a.pickNumber - b.pickNumber);

  // Assign in pick order so earlier picks claim starting slots, matching
  // what the export and the board already show.
  const assignments = assignRoster(
    inPickOrder.map((p) => p.player),
    slots
  );

  // assignRoster hands back a plain SlotSpec, which has no isBench - the
  // matching genuinely doesn't need it - so look it back up by name.
  const benchSlots = new Set(
    slots.filter((s) => s.isBench).map((s) => s.slotName)
  );

  const slotByPlayer = new Map<ScoutedPlayer, { name: string; starter: boolean }>();
  for (const { slot, player } of assignments) {
    if (player) {
      slotByPlayer.set(player, {
        name: slot.slotName,
        starter: !benchSlots.has(slot.slotName),
      });
    }
  }

  const scouted: ScoutedPick[] = inPickOrder.map((pick) => {
    const placed = slotByPlayer.get(pick.player);
    return {
      pickNumber: pick.pickNumber,
      round: pick.round,
      fullName: pick.player.fullName,
      position: pick.player.position,
      nflTeam: pick.player.nflTeam,
      adp: pick.player.adp,
      vsAdp:
        pick.player.adp === null
          ? null
          : Math.round((pick.player.adp - pick.pickNumber) * 10) / 10,
      slot: placed?.name ?? null,
      isStarter: placed?.starter ?? false,
    };
  });

  const byPosition: Record<string, number> = {};
  for (const pick of scouted) {
    const key = pick.position ?? "UNKNOWN";
    byPosition[key] = (byPosition[key] ?? 0) + 1;
  }

  const withAdp = scouted.filter((p) => p.vsAdp !== null);
  const sorted = [...withAdp].sort((a, b) => b.vsAdp! - a.vsAdp!);

  return {
    teamName,
    draftPosition,
    picks: scouted,
    byPosition,
    reaches: sorted.filter((p) => p.vsAdp! > 0).slice(0, 3),
    values: [...sorted].reverse().filter((p) => p.vsAdp! < 0).slice(0, 3),
    offTheBoard: scouted.filter((p) => p.adp === null),
    averageVsAdp: withAdp.length
      ? Math.round((withAdp.reduce((n, p) => n + p.vsAdp!, 0) / withAdp.length) * 10) / 10
      : null,
  };
}

/**
 * The report as plain prose, which is what actually goes into a prompt.
 *
 * Deliberately terse and factual - the voice comes from the examples, not
 * from here. Anything phrased as a judgement ("questionable reach") would
 * be the prompt grading the team instead of the grader doing it.
 */
export function describeReport(report: ScoutingReport): string {
  const lines: string[] = [];
  lines.push(`Team: ${report.teamName}`);
  if (report.draftPosition !== null) {
    lines.push(`Drafted from slot ${report.draftPosition}`);
  }

  const shape = Object.entries(report.byPosition)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pos, n]) => `${n} ${pos}`)
    .join(", ");
  lines.push(`Roster shape: ${shape}`);

  lines.push("");
  lines.push("Picks, in order:");
  for (const pick of report.picks) {
    const bits = [
      `  ${pick.pickNumber}. ${pick.fullName}`,
      `(${pick.position ?? "?"}${pick.nflTeam ? ` - ${pick.nflTeam}` : ""})`,
    ];
    if (pick.slot) bits.push(`-> ${pick.slot}`);
    if (pick.adp === null) {
      bits.push("- no ADP, undrafted in most leagues");
    } else if (pick.vsAdp !== null && pick.vsAdp > 0) {
      bits.push(`- ADP ${pick.adp}, taken ${pick.vsAdp} picks early`);
    } else if (pick.vsAdp !== null && pick.vsAdp < 0) {
      bits.push(`- ADP ${pick.adp}, taken ${Math.abs(pick.vsAdp)} picks late`);
    } else {
      bits.push(`- ADP ${pick.adp}, right on it`);
    }
    lines.push(bits.join(" "));
  }

  if (report.averageVsAdp !== null) {
    const avg = report.averageVsAdp;
    lines.push("");
    lines.push(
      avg > 0
        ? `Across the draft they took players ${avg} picks ahead of ADP on average.`
        : `Across the draft they took players ${Math.abs(avg)} picks behind ADP on average.`
    );
  }

  return lines.join("\n");
}
