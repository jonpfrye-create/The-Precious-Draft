"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { splitTeamName } from "@/lib/teams/branding";
import { ACTION_FAILED } from "@/lib/errors";
import { releaseTeamClaim } from "./actions";

export default function ClaimList({
  teams,
}: {
  teams: { id: string; name: string; claimed: boolean }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {teams.map((team) => {
          const { teamName, manager } = splitTeamName(team.name);
          return (
            <li
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{teamName}</span>
                {manager && (
                  <span className="block text-xs uppercase tracking-widest text-zinc-500">
                    {manager}
                  </span>
                )}
              </span>

              {team.claimed ? (
                confirming === team.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          try {
                            const r = await releaseTeamClaim(team.id);
                            if (!r.ok) setError(r.error ?? "That didn't work.");
                            setConfirming(null);
                            router.refresh();
                          } catch {
                            setError(ACTION_FAILED);
                          }
                        });
                      }}
                      className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Really release
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-sm text-zinc-500"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold uppercase text-green-800 dark:bg-green-950 dark:text-green-300">
                      Claimed
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirming(team.id)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Release
                    </button>
                  </span>
                )
              ) : (
                <span className="shrink-0 text-xs uppercase tracking-wider text-zinc-400">
                  Free
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </>
  );
}
