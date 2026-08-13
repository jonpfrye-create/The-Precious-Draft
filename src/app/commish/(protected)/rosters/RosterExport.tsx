"use client";

import { useState } from "react";

export default function RosterExport({
  text,
  perTeam,
}: {
  text: string;
  perTeam: { teamName: string; block: string }[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => copy(text, "all")}
          className="rounded bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          {copied === "all" ? "Copied!" : "Copy every roster"}
        </button>
        <p className="text-sm text-zinc-500">
          Or copy one team at a time — easier when you&apos;re entering them
          into Yahoo one by one.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {perTeam.map((team) => (
          <div
            key={team.teamName}
            className="rounded border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <span className="font-medium">{team.teamName}</span>
              <button
                type="button"
                onClick={() => copy(team.block, team.teamName)}
                className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
              >
                {copied === team.teamName ? "Copied!" : "Copy"}
              </button>
            </div>
            {/* Monospace and preserved whitespace: the slot labels are
                column-aligned, which is what makes it readable while
                typing it in. */}
            <pre className="overflow-x-auto px-4 py-3 font-mono text-sm">
              {team.block}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
