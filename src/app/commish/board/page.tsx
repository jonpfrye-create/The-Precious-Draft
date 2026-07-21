import { redirect } from "next/navigation";

// This page reads live draft state (picks, on-the-clock team) from
// Supabase on every load - it must never be statically prerendered, or
// it would freeze at whatever the state was during the build.
export const dynamic = "force-dynamic";
import {
  getAvailablePlayersForPhase,
  getCurrentPhase,
  getFirstLeague,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import DraftBoard from "./DraftBoard";

export default async function BoardPage() {
  const league = await getFirstLeague();
  if (!league) redirect("/commish/setup");

  const phase = await getCurrentPhase(league.id);
  if (!phase) redirect("/commish/setup");

  const [teams, rosterSlots, picks, availablePlayers] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getPicks(phase.id),
    getAvailablePlayersForPhase(phase),
  ]);

  const pickedPlayers = await getPlayersByIds(picks.map((p) => p.player_id));

  return (
    <DraftBoard
      league={league}
      phase={phase}
      teams={teams}
      rosterSlots={rosterSlots}
      picks={picks}
      pickedPlayers={pickedPlayers}
      availablePlayers={availablePlayers}
    />
  );
}
