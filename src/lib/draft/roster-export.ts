export interface ExportPlayer {
  full_name: string;
  position: string | null;
  nfl_team: string | null;
  /** The round this player was taken in. One pick per team per round. */
  round: number;
}

export interface TeamRoster {
  teamName: string;
  players: ExportPlayer[];
}

/**
 * The end-of-phase output: a per-team list in round order, as plain text
 * to be typed into Yahoo by hand.
 *
 * There is deliberately no Yahoo integration, so this is the only bridge
 * between the draft and the league site.
 *
 * **Round order, not roster order.** It used to print slot by slot - QB,
 * RB1, RB2 and so on - on the reasoning that Yahoo wants a starting
 * lineup. It doesn't: entering a draft on Yahoo means going round by
 * round saying who each team took, so a list sorted by position meant
 * hunting up and down it fourteen times per team. The order on the page
 * should match the order of the job.
 *
 * A snake draft gives every team exactly one pick per round, so round
 * order and pick order are the same list. Rounds are printed rather than
 * inferred from position in the array, because a released player (see
 * 006-releases-and-grades.sql) can leave a gap and a silently misnumbered
 * roster is worse than an obviously incomplete one.
 */
export function formatTeamRoster(roster: TeamRoster): string {
  const lines: string[] = [roster.teamName];

  const byRound = [...roster.players].sort((a, b) => a.round - b.round);
  const width = Math.max(
    ...byRound.map((p) => String(p.round).length),
    1
  );

  for (const player of byRound) {
    const round = String(player.round).padStart(width);
    const team = player.nfl_team ? ` (${player.nfl_team})` : "";
    const position = player.position ? ` ${player.position}` : "";
    lines.push(`  ${round}.  ${player.full_name}${team}${position}`);
  }

  if (byRound.length === 0) lines.push("  (no picks)");

  return lines.join("\n");
}

export function formatAllRosters(
  rosters: readonly TeamRoster[],
  heading: string
): string {
  // The heading and its underline are one block joined by a single
  // newline; blocks are then separated by blank lines. Treating the
  // underline as its own block puts a blank line between it and the
  // heading, which is not an underline any more.
  const header = `${heading}\n${"=".repeat(heading.length)}`;
  return [header, ...rosters.map(formatTeamRoster)].join("\n\n");
}
