import { redirect } from "next/navigation";
import { requireDrafterTeam } from "@/lib/auth/drafter";
import { claimedTeamIds } from "@/lib/auth/claims";
import { isPositionRevealed } from "@/lib/draft/order-draw";
import { lobbyState } from "@/lib/draft/lobby";
import {
  getCurrentPhase,
  getPhasesForLeague,
  getPicks,
  getTeamsForLeague,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { assignTeamColors } from "@/lib/teams/branding";
import LobbyView from "./LobbyView";

// Claim counts and reveal state change while people are looking at it.
export const dynamic = "force-dynamic";

/**
 * The waiting room, for everyone who isn't stood in front of the TV.
 *
 * One page with three states, because that is one flow to the people
 * using it: who has turned up, then the order turning over a pick at a
 * time, then the draft. The alternative - three routes and two redirects
 * - gives twelve phones three chances to be on the wrong one.
 *
 * Unrevealed draft positions are stripped here, on the server, and never
 * sent to the browser. RLS already refuses them to the public API
 * (supabase/003-order-reveal.sql), but every query on this page runs
 * through the service-role key, which bypasses RLS entirely - so the
 * gate has to be reapplied by hand on the way out. The same oversight is
 * what was quietly handing the whole order to /draft.
 */
export default async function LobbyPage() {
  const me = await requireDrafterTeam();

  const phases = await getPhasesForLeague(me.leagueId);
  const phase = (await getCurrentPhase(me.leagueId)) ?? phases[phases.length - 1];

  const [leagueTeams, claimed] = await Promise.all([
    getTeamsForLeague(me.leagueId),
    claimedTeamIds(me.leagueId),
  ]);

  const phaseTeams = phase ? await getTeamsForPhase(phase.id) : [];
  const picks = phase ? await getPicks(phase.id) : [];

  const state = lobbyState(
    phase
      ? {
          status: phase.status,
          orderDrawnAt: phase.order_drawn_at,
          revealedCount: phase.order_revealed_count,
        }
      : null,
    // The lobby counts the league, not the phase. Before the order is
    // drawn a phase may have no teams attached at all, and "0 of 0 here"
    // is not a waiting room.
    leagueTeams.length,
    claimed.size,
    picks.length
  );

  // The draft is under way - nobody belongs here.
  if (state.kind === "drafting") redirect("/draft");

  const colors = assignTeamColors(leagueTeams);

  const roster = [...leagueTeams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      here: claimed.has(t.id),
      isMe: t.id === me.teamId,
      hex: colors.get(t.id)?.hex ?? "#71717a",
    }));

  // One slot per draft position, newest reveals last. A slot the
  // commissioner hasn't turned over yet carries no team at all - not a
  // hidden name, no name.
  const total = phaseTeams.length;
  const revealedCount = phase?.order_revealed_count ?? 0;
  const slots = phaseTeams
    .map((t) => {
      const shown = isPositionRevealed(total, revealedCount, t.draft_position);
      return {
        position: t.draft_position,
        name: shown ? t.name : null,
        isMe: shown ? t.id === me.teamId : false,
        hex: shown ? colors.get(t.id)?.hex ?? "#71717a" : null,
      };
    })
    .sort((a, b) => a.position - b.position);

  // The field for the climb.
  //
  // Sorted by name, and that sort is load-bearing rather than tidiness:
  // `getTeamsForPhase` comes back in draft-position order, so shipping
  // the array as it arrived would hand the browser the entire draft
  // order through nothing but the order of the array - with every
  // position dutifully stripped out of it. Alphabetical carries nothing.
  const climbTeams = [...phaseTeams]
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      hex: colors.get(t.id)?.hex ?? "#71717a",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Only the slots actually turned over, same gate as the list above.
  const fellings = phaseTeams
    .filter((t) => isPositionRevealed(total, revealedCount, t.draft_position))
    .map((t) => ({ position: t.draft_position, teamId: t.id }));

  return (
    <LobbyView
      leagueId={me.leagueId}
      leagueName={me.leagueName}
      myTeamName={me.teamName}
      myTeamId={me.teamId}
      state={state}
      roster={roster}
      slots={slots}
      climbTeams={climbTeams}
      fellings={fellings}
      climbSeed={phase?.id ?? me.leagueId}
      phaseType={phase?.type ?? null}
      // Releasing your own team stops being safe the moment a pick
      // exists, and by then it is the commissioner's call anyway.
      canRelease={picks.length === 0}
    />
  );
}
