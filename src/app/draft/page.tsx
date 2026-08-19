import Link from "next/link";
import { requireDrafterTeam } from "@/lib/auth/drafter";
import { generateSnakeOrder, currentPick } from "@/lib/draft/snake-order";
import { assignRoster } from "@/lib/draft/roster-fit";
import {
  getCurrentPhase,
  getPhasesForLeague,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getDrafterSheetForPhase,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import DrafterView from "./DrafterView";
import Tabs from "./Tabs";

// Reads live draft state on every load - never prerender.
export const dynamic = "force-dynamic";

/**
 * One drafter, one phone.
 *
 * Deliberately not the board shrunk down. The board is a wall-sized
 * object that shows everything at once; this shows one person the two
 * things they need - whether it is their turn, and what is left - on a
 * screen they are holding one-handed with a drink in the other.
 */
export default async function DraftPage() {
  const me = await requireDrafterTeam();

  const phases = await getPhasesForLeague(me.leagueId);
  const phase = (await getCurrentPhase(me.leagueId)) ?? phases[phases.length - 1];

  if (!phase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">{me.teamName}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The draft hasn&apos;t started yet. This page will come alive when it
          does.
        </p>
      </main>
    );
  }

  const [teams, rosterSlots, picks, sheetPlayers] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getPicks(phase.id),
    getDrafterSheetForPhase(phase),
  ]);

  // A team that isn't in this phase - sat out Leftovers, say - gets told
  // so rather than a draft screen they can do nothing with.
  const inPhase = teams.some((t) => t.id === me.teamId);

  const snakeOrder = generateSnakeOrder(
    teams.map((t) => t.id),
    phase.rounds
  );
  const onClock = currentPick(snakeOrder, picks.length);
  const onClockTeam = onClock
    ? teams.find((t) => t.id === onClock.teamId) ?? null
    : null;

  const myPicks = picks.filter((p) => p.team_id === me.teamId);
  const myPlayers = await getPlayersByIds(myPicks.map((p) => p.player_id));
  const byId = new Map(myPlayers.map((p) => [p.player_id, p]));

  const slotSpecs = rosterSlots.map((slot) => ({
    slotName: slot.slot_name,
    eligiblePositions: slot.eligible_positions,
    isBench: slot.is_bench,
  }));

  // Same assignment the board and the Yahoo export use, so a roster reads
  // the same everywhere.
  const roster = assignRoster(
    myPicks
      .map((p) => byId.get(p.player_id))
      .filter((p) => p !== undefined),
    slotSpecs
  ).map((a) => ({
    slotName: a.slot.slotName,
    playerName: a.player?.full_name ?? null,
    nflTeam: a.player?.nfl_team ?? null,
    position: a.player?.position ?? null,
  }));

  return (
    <>
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <Tabs />
      </div>
      <DrafterView
        teamName={me.teamName}
        leagueName={me.leagueName}
        phaseType={phase.type}
        phaseId={phase.id}
        inPhase={inPhase}
        isMyTurn={onClock?.teamId === me.teamId}
        onClockTeamName={onClockTeam?.name ?? null}
        round={onClock?.round ?? null}
        overallPick={onClock?.overallPick ?? null}
        totalPicks={snakeOrder.length}
        picksMade={picks.length}
        roster={roster}
        slots={slotSpecs}
        draftedPositions={myPicks
          .map((p) => byId.get(p.player_id)?.position ?? null)
          .filter((p): p is string => p !== null)}
        sheetPlayers={sheetPlayers}
      />
      <p className="pb-8 text-center text-xs text-zinc-500">
        <Link href="/draft/leave" className="underline">
          Not your team?
        </Link>
      </p>
    </>
  );
}
