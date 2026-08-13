"use client";

import { useState } from "react";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function AccessCodes({
  leagueCode,
  commissionerLink,
}: {
  leagueCode: string;
  commissionerLink: string;
}) {
  // The commissioner link is hidden until asked for. This page gets opened
  // on the same laptop that's mirrored to the TV, and anyone in the room
  // with a phone camera would otherwise walk away with pick-and-undo rights.
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <section className="flex flex-col gap-3 rounded border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">League code</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Safe to share with everyone. Lets a drafter claim their team and
          make their own picks — nothing else.
        </p>
        <div className="flex items-center gap-3">
          <span className="rounded bg-zinc-100 px-4 py-3 font-mono text-2xl tracking-widest dark:bg-zinc-900">
            {leagueCode}
          </span>
          <CopyButton value={leagueCode} label="Copy code" />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded border border-amber-300 p-5 dark:border-amber-800">
        <h2 className="text-lg font-semibold">Commissioner link</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Keep this to yourself.</strong> Anyone with this link can
          enter picks for any team and undo picks. Don&apos;t show it on the
          TV, and don&apos;t paste it in the league chat.
        </p>
        {revealed ? (
          <div className="flex flex-col gap-3">
            <code className="break-all rounded bg-zinc-100 px-4 py-3 font-mono text-sm dark:bg-zinc-900">
              {commissionerLink}
            </code>
            <div className="flex gap-3">
              <CopyButton value={commissionerLink} label="Copy link" />
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Hide
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Show commissioner link
          </button>
        )}
      </section>
    </div>
  );
}
