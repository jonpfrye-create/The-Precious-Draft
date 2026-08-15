"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeColor } from "@/lib/draft/grades";
import { sealClamsGrade, revealClamsGrade } from "./clams-actions";

/**
 * The sealed envelope, per team.
 *
 * Three states, in the order they happen on the night:
 *   unsealed  - nothing generated yet
 *   sealed    - generated, hidden, timestamped. The commissioner announces
 *               his own grade out loud during this state.
 *   revealed  - both grades face up, side by side.
 *
 * The sealed state deliberately shows the time and nothing else. That
 * timestamp is the whole proof: it predates his grade, so "it never saw my
 * answer" is something the room can check rather than take on trust.
 */

export interface ClamsState {
  sealedAt: string | null;
  revealedAt: string | null;
  grade: string | null;
  comment: string | null;
  model: string | null;
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ClamsPanel({
  phaseId,
  teamId,
  state,
  commissionerGrade,
}: {
  phaseId: string;
  teamId: string;
  state: ClamsState;
  commissionerGrade: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set when the reveal happens with this component already on screen, so
  // the card only flips the once. Re-reading the page later shouldn't
  // replay the moment.
  const [justRevealed, setJustRevealed] = useState(false);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    onDone?: () => void
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "That didn't work.");
          return;
        }
        onDone?.();
        router.refresh();
      } catch {
        setError("Couldn't reach the server.");
      }
    });
  }

  // Revealed. Deliberately does not require the commissioner to have
  // entered his own grade: he says it out loud, opens this, and types his
  // in afterwards. Typing first and then revealing makes the machine look
  // like it read his answer.
  if (state.revealedAt && state.grade) {
    const agrees = commissionerGrade === state.grade;
    return (
      <div
        className={`flex flex-col gap-2 rounded-lg border-2 border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/40 ${
          justRevealed ? "animate-flip" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
            Clams AI
            {agrees && (
              <span className="ml-2 rounded bg-violet-200 px-1.5 py-0.5 text-violet-900 dark:bg-violet-900 dark:text-violet-100">
                Same grade
              </span>
            )}
          </span>
          <span
            className={`rounded-lg border-2 px-3 py-1.5 text-xl font-black ${gradeColor(state.grade)}`}
          >
            {state.grade}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
          {state.comment}
        </p>
        {state.sealedAt && (
          <p className="text-xs text-violet-700/70 dark:text-violet-400/70">
            {commissionerGrade
              ? `Sealed at ${timeOnly(state.sealedAt)}, before you graded.`
              : `Sealed at ${timeOnly(state.sealedAt)}. Your grade goes in above — it hasn't seen it.`}
          </p>
        )}
      </div>
    );
  }

  // Sealed: exists, hidden, waiting. Nothing about the grade is in the
  // browser at all - the server deliberately doesn't send it.
  if (state.sealedAt) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
            Clams AI — sealed {timeOnly(state.sealedAt)}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => revealClamsGrade(phaseId, teamId),
                () => setJustRevealed(true)
              )
            }
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {isPending ? "Opening…" : "Reveal"}
          </button>
        </div>
        <p className="text-xs text-violet-700/70 dark:text-violet-400/70">
          Written and locked. Announce your grade in the room, open this,
          then type yours in.
        </p>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Unsealed.
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => sealClamsGrade(phaseId, teamId))}
        className="self-start rounded border border-violet-300 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
      >
        {isPending ? "Writing…" : "Seal Clams AI"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
