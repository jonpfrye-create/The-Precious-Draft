import Link from "next/link";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { isDemoLeague } from "@/lib/draft/auto-pick";
import {
  getCurrentPhase,
  getPicks,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { PHASE_LABELS, type PhaseType } from "@/lib/draft/phase-templates";
import DemoControls from "./DemoControls";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const league = await requireCommissionerLeague();

  // Not a redirect: someone landing here on the real league should be told
  // why there's nothing to do, not silently bounced.
  if (!isDemoLeague(league.name)) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-6 py-16 dark:bg-black">
        <h1 className="text-3xl font-semibold">Demo controls are off here</h1>
        <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
          You&apos;re signed in to <strong>{league.name}</strong>, a real
          league. Auto-drafting is only ever available on the throwaway demo
          league, so a demo can never put fake picks into a real draft.
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

  const phase = await getCurrentPhase(league.id);
  if (!phase) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-6 py-16 dark:bg-black">
        <h1 className="text-3xl font-semibold">Every phase is complete</h1>
        <Link
          href="/commish/board"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to the board
        </Link>
      </div>
    );
  }

  const [teams, picks] = await Promise.all([
    getTeamsForPhase(phase.id),
    getPicks(phase.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-3xl font-semibold">Demo controls</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Fast-forward a draft so the whole thing can be shown without
          entering picks by hand.
        </p>
      </div>

      <DemoControls
        phaseLabel={PHASE_LABELS[phase.type as PhaseType]}
        picksMade={picks.length}
        totalPicks={teams.length * phase.rounds}
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
