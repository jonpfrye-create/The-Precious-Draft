"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAsCommissioner } from "./actions";
import { ACTION_FAILED } from "@/lib/errors";

export default function LoginForm({
  initialError,
}: {
  initialError?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await signInAsCommissioner(input);
        if (result.ok) {
          router.push("/commish/board");
          router.refresh();
        } else {
          setError(result.error ?? "That didn't work.");
        }
      } catch {
        setError(ACTION_FAILED);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <label className="text-sm font-medium" htmlFor="commish-secret">
        Commissioner link or code
      </label>
      <input
        id="commish-secret"
        className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste your commissioner link here"
        autoComplete="off"
        autoFocus
      />
      <p className="text-sm text-zinc-500">
        You can paste the whole link or just the code itself — either works.
      </p>

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Checking..." : "Open the draft board"}
      </button>
    </form>
  );
}
