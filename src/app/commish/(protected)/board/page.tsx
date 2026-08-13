import { redirect } from "next/navigation";

// This page reads live draft state (picks, on-the-clock team) from
// Supabase on every load - it must never be statically prerendered, or
// it would freeze at whatever the state was during the build.
export const dynamic = "force-dynamic";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { ensureLeagueSecrets } from "@/lib/auth/secrets";
import { isDemoLeague } from "@/lib/draft/auto-pick";
import {
  getAvailablePlayersForPhase,
  getCurrentPhase,
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

  const phase = await getCurrentPhase(league.id);
  if (!phase) redirect("/commish/setup");

  const [teams, rosterSlots, picks, availablePlayers] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getPicks(phase.id),
    getAvailablePlayersForPhase(phase),
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
      availablePlayers={availablePlayers}
    />
  );
}
