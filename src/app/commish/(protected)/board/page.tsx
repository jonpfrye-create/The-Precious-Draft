import { redirect } from "next/navigation";

// This page reads live draft state (picks, on-the-clock team) from
// Supabase on every load - it must never be statically prerendered, or
// it would freeze at whatever the state was during the build.
export const dynamic = "force-dynamic";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { ensureLeagueSecrets } from "@/lib/auth/secrets";
import { isDemoLeague } from "@/lib/draft/auto-pick";
import { commissionerDestination } from "@/lib/draft/navigation";
import {
  getSheetPlayersForPhase,
  getCurrentPhase,
  getPhasesForLeague,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import DraftBoard from "./DraftBoard";

export default async function BoardPage() {
  // The league comes from the commissioner's own secret, not from "whichever
  // league is oldest" - so creating a second league doesn't strand them on
  // the first one.
  const league = await requireCommissionerLeague();

  // Once every phase is complete there is no "current" phase, but the
  // board is still the thing people want to look at - it's the finished
  // draft. Fall back to the last phase rather than redirecting.
  const phases = await getPhasesForLeague(league.id);
  const phase =
    (await getCurrentPhase(league.id)) ?? phases[phases.length - 1] ?? null;
  if (!phase) redirect(await commissionerDestination(league.id));

  const [teams, rosterSlots, picks, sheetPlayers] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getPicks(phase.id),
    getSheetPlayersForPhase(phase),
  ]);

  const pickedPlayers = await getPlayersByIds(picks.map((p) => p.player_id));

  // Only the league code goes to the board. The board lives on a TV in a
  // room full of people, so the commissioner secret stays on /commish/access
  // where it can be revealed deliberately.
  const { leagueCode } = await ensureLeagueSecrets(league.id);

  return (
    <DraftBoard
      league={league}
      leagueCode={leagueCode}
      isDemo={isDemoLeague(league.name)}
      phase={phase}
      teams={teams}
      rosterSlots={rosterSlots}
      picks={picks}
      pickedPlayers={pickedPlayers}
      sheetPlayers={sheetPlayers}
    />
  );
}
