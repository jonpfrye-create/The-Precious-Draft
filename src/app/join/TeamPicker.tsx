"use client";

import { useState, useTransition } from "react";
import { splitTeamName } from "@/lib/teams/branding";
import { ACTION_FAILED } from "@/lib/errors";
import { claimTeamAction } from "./actions";

export interface JoinableTeam {
  id: string;
  name: string;
  taken: boolean;
}

export default function TeamPicker({
  leagueName,
  teams,
}: {
  leagueName: string;
  teams: JoinableTeam[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-5 px-5 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Which one is yours?</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {leagueName}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {teams.map((team) => {
          const { teamName, manager } = splitTeamName(team.name);
          return (
            <li key={team.id}>
              <button
                type="button"
                disabled={team.taken || isPending}
                onClick={() => {
                  setError(null);
                  setClaiming(team.id);
                  startTransition(async () => {
                    try {
                      // On success this redirects, so nothing after it
                      // runs in the happy case.
                      const result = await claimTeamAction(team.id);
                      if (result && !result.ok) {
                        setError(result.error ?? "That didn't work.");
                        setClaiming(null);
                      }
                    } catch {
                      setError(ACTION_FAILED);
                      setClaiming(null);
                    }
                  });
                }}
                // Big targets: this is a phone, in a room, one-handed.
                className={`flex w-full items-center justify-between gap-3 rounded-lg border-2 px-4 py-4 text-left ${
                  team.taken
                    ? "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                    : "border-zinc-300 hover:border-black dark:border-zinc-700 dark:hover:border-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {teamName}
                  </span>
                  {manager && (
                    <span className="block truncate text-xs uppercase tracking-widest text-zinc-500">
                      {manager}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs uppercase tracking-wider text-zinc-500">
                  {claiming === team.id
                    ? "…"
                    : team.taken
                      ? "Taken"
                      : "Claim"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-center text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="text-center text-xs text-zinc-500">
        Picked the wrong one? The commissioner can hand it back.
      </p>
    </main>
  );
}
