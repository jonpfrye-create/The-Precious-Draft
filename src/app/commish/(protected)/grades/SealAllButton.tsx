"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sealAllClamsGrades } from "./clams-actions";

/**
 * Seals every team at once, before grading night starts.
 *
 * "They were all written before we began" is the cleanest version of the
 * claim to make out loud, and it gets the waiting out of the way so the
 * reveals themselves are instant. Per-team sealing still exists on each
 * card for anyone who'd rather do it one at a time.
 */
export default function SealAllButton({
  phaseId,
  unsealed,
  corpusSize,
  hasViews,
}: {
  phaseId: string;
  unsealed: number;
  corpusSize: number;
  hasViews: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (unsealed === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-violet-900 dark:text-violet-200">
            Clams AI
          </p>
          <p className="text-sm text-violet-800/80 dark:text-violet-300/80">
            {corpusSize === 0
              ? "No grades of yours saved yet — it has nothing to imitate."
              : `Learned from ${corpusSize} ${corpusSize === 1 ? "grade" : "grades"} you've written.`}{" "}
            {hasViews
              ? "Using your own views on players and roster building."
              : "No views of yours written down yet — grading against consensus ADP."}{" "}
            {unsealed} {unsealed === 1 ? "team" : "teams"} still unsealed.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setNeedsKey(false);
            setDone(null);
            startTransition(async () => {
              try {
                const result = await sealAllClamsGrades(phaseId);
                if (!result.ok) {
                  setError(result.error ?? "That didn't work.");
                  setNeedsKey(Boolean(result.needsApiKey));
                  return;
                }
                setDone(
                  `Sealed ${result.sealed}${result.skipped ? `, skipped ${result.skipped}` : ""}.`
                );
                router.refresh();
              } catch {
                setError("Couldn't reach the server.");
              }
            });
          }}
          className="rounded bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {isPending ? "Writing grades…" : `Seal all ${unsealed}`}
        </button>
      </div>

      <p className="text-xs text-violet-800/70 dark:text-violet-300/70">
        Seal before you announce anything. Each grade is written blind — Clams
        AI is never shown your grade for the team it&apos;s grading — and stays
        hidden until you press Reveal.
      </p>

      {done && (
        <p className="text-sm text-green-700 dark:text-green-400">{done}</p>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          <p>{error}</p>
          {needsKey && (
            <p className="mt-1 text-red-700/80 dark:text-red-300/80">
              Nothing was charged and nothing was saved. Everything else on
              this page still works.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
