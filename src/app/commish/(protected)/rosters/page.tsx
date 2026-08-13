import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import {
  getPhasesForLeague,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { PHASE_LABELS, type PhaseType } from "@/lib/draft/phase-templates";
import { formatAllRosters, formatTeamRoster } from "@/lib/draft/roster-export";
import RosterExport from "./RosterExport";

export const dynamic = "force-dynamic";

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const league = await requireCommissionerLeague();
  const phases = await getPhasesForLeague(league.id);
  if (phases.length === 0) redirect("/commish/setup");

  const { phase: requested } = await searchParams;
  // Defaults to the phase being drafted, or the last one if everything is
  // finished - which is what you want the moment a phase ends.
  const phase =
    phases.find((p) => p.id === requested) ??
    phases.find((p) => p.status !== "completed") ??
    phases[phases.length - 1];

  const [teams, slots, picks] = await Promise.all([
    getTeamsForPhase(phase.id),
    getRosterSlots(phase.id),
    getPicks(phase.id),
  ]);
  const players = await getPlayersByIds(picks.map((p) => p.player_id));
  const playerById = new Map(players.map((p) => [p.player_id, p]));

  const slotSpecs = slots.map((slot) => ({
    slotName: slot.slot_name,
    eligiblePositions: slot.eligible_positions,
  }));

  const rosters = teams.map((team) => ({
    teamName: team.name,
    players: picks
      .filter((pick) => pick.team_id === team.id)
      .map((pick) => playerById.get(pick.player_id))
      .filter((p) => p !== undefined)
      .map((p) => ({
        full_name: p.full_name,
        position: p.position,
        nfl_team: p.nfl_team,
      })),
  }));

  const label = PHASE_LABELS[phase.type as PhaseType];
  const heading = `${league.name} — ${label} rosters`;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <h1 className="text-3xl font-semibold">{label} rosters</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Slot by slot, ready to type into Yahoo.{" "}
          {picks.length < teams.length * phase.rounds && (
            <span className="font-medium text-amber-700 dark:text-amber-500">
              This phase isn&apos;t finished — {picks.length} of{" "}
              {teams.length * phase.rounds} picks made.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          {phases.map((p) => (
            <Link
              key={p.id}
              href={`/commish/rosters?phase=${p.id}`}
              className={
                p.id === phase.id
                  ? "font-semibold underline"
                  : "text-blue-600 hover:underline dark:text-blue-400"
              }
            >
              {PHASE_LABELS[p.type as PhaseType]}
            </Link>
          ))}
        </div>
      </div>

      <RosterExport
        text={formatAllRosters(rosters, slotSpecs, heading)}
        perTeam={rosters.map((roster) => ({
          teamName: roster.teamName,
          block: formatTeamRoster(roster, slotSpecs),
        }))}
      />

      <Link
        href="/commish/board"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to the draft board
      </Link>
    </div>
  );
}
