import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import {
  getPhasesForLeague,
  getRosterSlots,
  getTeamsForLeague,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import {
  nextPhaseType,
  PHASE_LABELS,
  templateForPhase,
  type PhaseType,
} from "@/lib/draft/phase-templates";
import NextPhaseForm from "./NextPhaseForm";

export const dynamic = "force-dynamic";

export default async function NextPhasePage() {
  const league = await requireCommissionerLeague();
  const phases = await getPhasesForLeague(league.id);

  if (phases.length === 0) redirect("/commish/setup");

  const latest = phases[phases.length - 1];

  // Still drafting: there's nothing to set up yet.
  if (latest.status !== "completed") redirect("/commish/board");

  const type = nextPhaseType(latest.type as PhaseType);
  if (!type) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-6 py-16 dark:bg-black">
        <h1 className="text-4xl font-semibold">That&apos;s the whole draft</h1>
        <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
          Main, Leftovers and Microwave are all complete. Nothing follows
          Microwave.
        </p>
        <Link
          href="/commish/board"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to the board
        </Link>
      </div>
    );
  }

  const [allTeams, previousTeams, previousSlots] = await Promise.all([
    getTeamsForLeague(league.id),
    getTeamsForPhase(latest.id),
    getRosterSlots(latest.id),
  ]);

  const playedPrevious = new Set(previousTeams.map((t) => t.id));

  // Every team in the league is listed, not just the ones who played the
  // previous phase - someone who sat out Leftovers can still play
  // Microwave. Ticking follows the previous phase; the room overrides it.
  const teamOptions = [...allTeams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => ({
      id: team.id,
      name: team.name,
      playedPrevious: playedPrevious.has(team.id),
    }));

  const defaultSlots = templateForPhase(
    type,
    previousSlots.map((slot) => ({
      slotName: slot.slot_name,
      eligiblePositions: slot.eligible_positions,
      isBench: slot.is_bench,
    }))
  );

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <NextPhaseForm
        phaseType={type}
        previousPhaseLabel={PHASE_LABELS[latest.type as PhaseType]}
        teams={teamOptions}
        defaultSlots={defaultSlots}
      />
    </div>
  );
}
