import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import {
  getCurrentPhase,
  getPicks,
  getTeamsForLeague,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { assignTeamColors } from "@/lib/teams/branding";
import { isPositionRevealed } from "@/lib/draft/order-draw";
import OrderDraw from "./OrderDraw";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  // Same ?view= lever as the lobby, and the same localStorage key behind
  // it, so one link puts the television back on the plain list too. On
  // the night this screen is the one that matters most and the one that
  // cannot be redeployed.
  const requested = (await searchParams).view;
  const forcedView =
    requested === "list" ? "list" : requested === "climb" ? "climb" : null;

  const league = await requireCommissionerLeague();
  const phase = await getCurrentPhase(league.id);
  if (!phase) redirect("/commish/setup");

  const [teams, picks, leagueTeams] = await Promise.all([
    getTeamsForPhase(phase.id),
    getPicks(phase.id),
    getTeamsForLeague(league.id),
  ]);

  // Seeded from the whole league so colours don't shift between phases.
  // Serialised as a plain object because a Map can't cross into a client
  // component.
  const colorByTeamId = Object.fromEntries(assignTeamColors(leagueTeams));

  // The climb's field and its fellings, built exactly the way
  // lobby/page.tsx builds them. "Exactly" is the point: the mascot dealt
  // to a team, the hazard that fells it and the lane it walks in are all
  // functions of the field, the seed and the felled position, so any
  // difference here would put a different animal on the television than
  // the one on twelve phones.
  //
  // Sorted by name for the same reason as the lobby. Nothing on this
  // page needs hiding from the commissioner - he is looking at the whole
  // order in the list below - but keeping one construction rather than
  // two is what stops the two screens drifting apart.
  const climbTeams = [...teams]
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      hex: colorByTeamId[t.id]?.hex ?? "#71717a",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const fellings = teams
    .filter((t) =>
      isPositionRevealed(teams.length, phase.order_revealed_count, t.draft_position)
    )
    .map((t) => ({ position: t.draft_position, teamId: t.id }));

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-zinc-500">
          {phase.type} draft
        </p>
        <h1 className="text-4xl font-semibold">Draft order</h1>
      </div>
      <OrderDraw
        phase={phase}
        teams={teams}
        picksMade={picks.length}
        colorByTeamId={colorByTeamId}
        climbTeams={climbTeams}
        fellings={fellings}
        climbSeed={phase.id}
        forcedView={forcedView}
      />
    </div>
  );
}
