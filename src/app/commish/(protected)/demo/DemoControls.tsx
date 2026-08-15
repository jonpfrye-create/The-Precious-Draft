"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDemo, simulatePicks } from "./actions";
import { ACTION_FAILED } from "@/lib/errors";

export default function DemoControls({
  phaseLabel,
  picksMade,
  totalPicks,
}: {
  phaseLabel: string;
  picksMade: number;
  totalPicks: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; picksMade?: number }>, label: string) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "That didn't work.");
          return;
        }
        setStatus(
          result.picksMade === 0
            ? `${label} — done.`
            : `${label} — ${result.picksMade} picks made.`
        );
        router.refresh();
      } catch {
        setError(ACTION_FAILED);
      }
    });
  }

  const remaining = totalPicks - picksMade;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="rounded border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <p className="font-medium">This is the demo league.</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          It uses your real team names but is entirely separate from the real
          draft. Nothing here can touch The Precious — the server refuses
          these actions on any other league, not just hides the buttons.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          {phaseLabel} — {picksMade} of {totalPicks} picks
        </h2>
        <div className="h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-black transition-all duration-500 dark:bg-white"
            style={{
              width: `${totalPicks > 0 ? (picksMade / totalPicks) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {[1, 5, 12, 25].map((n) => (
          <button
            key={n}
            type="button"
            disabled={isPending || remaining <= 0}
            onClick={() => run(() => simulatePicks(n), `Drafted ${n}`)}
            className="rounded bg-black px-5 py-3 font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black"
          >
            +{n} {n === 1 ? "pick" : "picks"}
          </button>
        ))}
        <button
          type="button"
          disabled={isPending || remaining <= 0}
          onClick={() => run(() => simulatePicks(totalPicks), "Finished the phase")}
          className="rounded border-2 border-black px-5 py-3 font-medium disabled:opacity-30 dark:border-white"
        >
          Finish this phase ({remaining} left)
        </button>
      </div>

      {status && <p className="text-green-700 dark:text-green-400">{status}</p>}
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(
                "Wipe every pick in the demo league and start again from an undrawn Main draft?"
              )
            ) {
              run(resetDemo, "Reset");
            }
          }}
          className="rounded border border-red-300 px-5 py-3 text-red-600 disabled:opacity-30 dark:border-red-800 dark:text-red-400"
        >
          Reset the demo
        </button>
        <p className="mt-2 text-sm text-zinc-500">
          Clears every pick, removes Leftovers and Microwave, and puts Main
          back to an undrawn order — so you can show the whole thing again
          from the top. Your commissioner link keeps working.
        </p>
      </div>
    </div>
  );
}
