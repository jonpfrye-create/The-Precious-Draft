import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDrafterTeam } from "@/lib/auth/drafter";
import { generateSnakeOrder } from "@/lib/draft/snake-order";
import { assignRoster } from "@/lib/draft/roster-fit";
import { belongsInLobby } from "@/lib/draft/lobby";
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

  // A draft whose order hasn't finished being revealed belongs to the
  // lobby, not here.
  //
  // This is a leak, not a tidiness problem. Every query on this page runs
  // through the service-role key, which bypasses RLS - so the reveal
  // gating in supabase/003-order-reveal.sql, which stops anyone pulling
  // an unrevealed draft position out of the public API, does nothing
  // whatsoever for this page. Rendering it early puts the whole order
  // into twelve browsers before a single slot has been turned over.
  //
  // 003 predates drafter pages existing at all; there was no way in then.
  // The same function decides this on both sides, so the two pages cannot
  // disagree about who belongs where.
  if (
    belongsInLobby(
      {
        status: phase.status,
        orderDrawnAt: phase.order_drawn_at,
        revealedCount: phase.order_revealed_count,
      },
      teams.length,
      picks.length
    )
  ) {
    redirect("/lobby");
  }

  // A team that isn't in this phase - sat out Leftovers, say - gets told
  // so rather than a draft screen they can do nothing with.
  const inPhase = teams.some((t) => t.id === me.teamId);

  const snakeOrder = generateSnakeOrder(
    teams.map((t) => t.id),
    phase.rounds
  );
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
        totalPicks={snakeOrder.length}
        myTeamId={me.teamId}
        // Team ids in draft order, so the clock can be recomputed in the
        // browser when a pick lands rather than refetched.
        teamIds={teams.map((t) => t.id)}
        teamNames={Object.fromEntries(teams.map((t) => [t.id, t.name]))}
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
