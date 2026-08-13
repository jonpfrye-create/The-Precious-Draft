import { assignRoster, unassignedPlayers, type SlotSpec } from "./roster-fit";

export interface ExportPlayer {
  full_name: string;
  position: string | null;
  nfl_team: string | null;
}

export interface TeamRoster {
  teamName: string;
  players: ExportPlayer[];
}

/**
 * The end-of-phase output: a per-team roster checklist in roster-slot
 * order, as plain text to be typed into Yahoo by hand.
 *
 * There is deliberately no Yahoo integration, so this is the only bridge
 * between the draft and the league site. It's slot-ordered rather than
 * pick-ordered because Yahoo asks for a starting lineup, not a draft
 * history.
 */
export function formatTeamRoster(
  roster: TeamRoster,
  slots: readonly SlotSpec[]
): string {
  const lines: string[] = [roster.teamName];

  const assigned = assignRoster(roster.players, slots);
  const width = Math.max(...slots.map((s) => s.slotName.length), 4);

  for (const { slot, player } of assigned) {
    const label = slot.slotName.padEnd(width);
    if (!player) {
      lines.push(`  ${label}  -`);
      continue;
    }
    const team = player.nfl_team ? ` (${player.nfl_team})` : "";
    lines.push(`  ${label}  ${player.full_name}${team}`);
  }

  // Should never happen for a roster built through the board, since
  // makePick refuses picks that don't fit. Printed rather than dropped, so
  // a mismatch is visible instead of quietly costing someone a player.
  const orphans = unassignedPlayers(roster.players, slots);
  if (orphans.length > 0) {
    lines.push(
      `  !! no slot for: ${orphans.map((p) => p.full_name).join(", ")}`
    );
  }

  return lines.join("\n");
}

export function formatAllRosters(
  rosters: readonly TeamRoster[],
  slots: readonly SlotSpec[],
  heading: string
): string {
  // The heading and its underline are one block joined by a single
  // newline; blocks are then separated by blank lines. Treating the
  // underline as its own block puts a blank line between it and the
  // heading, which is not an underline any more.
  const header = `${heading}\n${"=".repeat(heading.length)}`;
  return [
    header,
    ...rosters.map((roster) => formatTeamRoster(roster, slots)),
  ].join("\n\n");
}
