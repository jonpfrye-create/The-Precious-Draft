"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACTION_FAILED } from "@/lib/errors";
import { enterLeagueCode } from "./actions";

export default function CodeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Join the draft</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Type the league code from the board.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const result = await enterLeagueCode(code);
              if (!result.ok) {
                setError(result.error ?? "That didn't work.");
                return;
              }
              router.refresh();
            } catch {
              setError(ACTION_FAILED);
            }
          });
        }}
        className="flex flex-col gap-4"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // A code read off a television and typed on a phone: big, and
          // with every keyboard convenience that could mangle it turned
          // off. It is Crockford base32, so case never matters.
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC123"
          aria-label="League code"
          className="rounded-lg border-2 border-zinc-300 px-4 py-4 text-center font-mono text-2xl uppercase tracking-[0.3em] dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={isPending || code.trim().length === 0}
          className="rounded-lg bg-black px-6 py-4 text-lg font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {isPending ? "Checking…" : "Continue"}
        </button>
      </form>

      {error && (
        <p className="text-center text-red-600 dark:text-red-400">{error}</p>
      )}
    </main>
  );
}
