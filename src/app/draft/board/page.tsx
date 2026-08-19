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

export const dynamic = "force-dynamic";

/**
 * The board, for a phone.
 *
 * Not the television grid scaled down - twelve columns by fourteen rounds
 * is unreadable at this width. What someone actually wants in their hand
 * is what just happened and what each team has, so it leads with the
 * picks in reverse order and puts the grid behind a team at a time.
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

  return (
    <main className="mx-auto w-full max-w-md px-4 py-4">
      <Tabs />
      <MobileBoard
        phaseId={phase.id}
        phaseType={phase.type}
        rounds={phase.rounds}
        myTeamId={me.teamId}
        onClockTeamId={onClock?.teamId ?? null}
        picksMade={picks.length}
        totalPicks={snakeOrder.length}
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          draftPosition: t.draft_position,
          hex: colors.get(t.id)?.hex ?? "#71717a",
          onHex: colors.get(t.id)?.onHex ?? "#ffffff",
        }))}
        picks={[...picks]
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
          }))}
      />
    </main>
  );
}
