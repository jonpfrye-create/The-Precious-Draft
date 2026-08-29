import { requireDrafterTeam } from "@/lib/auth/drafter";
import { generateSnakeOrder, currentPick } from "@/lib/draft/snake-order";
import { assignTeamColors } from "@/lib/teams/branding";
import {
  getCurrentPhase,
  getPhasesForLeague,
  getPicks,
  getPlayersByIds,
  getTeamsForLeague,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import Tabs from "../Tabs";
import MobileBoard from "./MobileBoard";
import WideBoard from "./WideBoard";
import BoardSync from "./BoardSync";

export const dynamic = "force-dynamic";

/**
 * The board, for everyone who isn't the commissioner.
 *
 * Two of them, chosen by screen width rather than by asking. On a phone
 * the television grid scaled down is unreadable, so it leads with the
 * picks in reverse order and puts the roster behind a team at a time. On
 * a laptop that same list is a waste of a screen - half the league
 * drafted the practice round from laptops and wanted the grid - so the
 * grid is what they get.
 *
 * Both are rendered and one is hidden in CSS, rather than measured in
 * JavaScript. A width read after mount means a visible flip from one
 * board to the other on every single load, and this page is opened a
 * hundred and sixty-eight times in an evening.
 */
export default async function DrafterBoardPage() {
  const me = await requireDrafterTeam();
  const phases = await getPhasesForLeague(me.leagueId);
  const phase = (await getCurrentPhase(me.leagueId)) ?? phases[phases.length - 1];

  if (!phase) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <Tabs />
        <p className="text-center text-zinc-500">The draft hasn&apos;t started.</p>
      </main>
    );
  }

  const [teams, picks, allTeams] = await Promise.all([
    getTeamsForPhase(phase.id),
    getPicks(phase.id),
    getTeamsForLeague(me.leagueId),
  ]);
  const players = await getPlayersByIds(picks.map((p) => p.player_id));
  const byId = new Map(players.map((p) => [p.player_id, p]));

  const snakeOrder = generateSnakeOrder(
    teams.map((t) => t.id),
    phase.rounds
  );
  const onClock = currentPick(snakeOrder, picks.length);

  // Seeded from the whole league so a team keeps its colour across every
  // phase - the same rule the television board follows.
  const colors = assignTeamColors(allTeams);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  const boardProps = {
    phaseType: phase.type,
    rounds: phase.rounds,
    myTeamId: me.teamId,
    onClockTeamId: onClock?.teamId ?? null,
    picksMade: picks.length,
    totalPicks: snakeOrder.length,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      draftPosition: t.draft_position,
      hex: colors.get(t.id)?.hex ?? "#71717a",
      onHex: colors.get(t.id)?.onHex ?? "#ffffff",
    })),
    // Newest first, which is the order the phone reads them in. The grid
    // files them by round and team, so the sort costs it nothing.
    picks: [...picks]
      .sort((a, b) => b.pick_number - a.pick_number)
      .map((p) => ({
        id: p.id,
        pickNumber: p.pick_number,
        round: p.round,
        teamId: p.team_id,
        teamName: teamById.get(p.team_id)?.name ?? "",
        playerName: byId.get(p.player_id)?.full_name ?? "Unknown",
        position: byId.get(p.player_id)?.position ?? null,
        nflTeam: byId.get(p.player_id)?.nfl_team ?? null,
        hasAdp: Boolean(byId.get(p.player_id)?.adp_formatted),
      })),
  };

  return (
    <>
      {/* One subscription, shared by both boards below. */}
      <BoardSync phaseId={phase.id} />

      {/* Phone: the feed, at the width it was designed for. */}
      <main className="mx-auto w-full max-w-md px-4 py-4 lg:hidden">
        <Tabs />
        <MobileBoard {...boardProps} />
      </main>

      {/* Laptop: the whole grid, with room to breathe. */}
      <main className="mx-auto hidden w-full max-w-[1600px] px-6 py-6 lg:block">
        <Tabs />
        <WideBoard {...boardProps} />
      </main>
    </>
  );
}
