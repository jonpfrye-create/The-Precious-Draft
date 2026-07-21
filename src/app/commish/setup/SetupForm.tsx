"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeagueAndMainPhase } from "./actions";

type SlotKind = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "BENCH";

const SLOT_KIND_POSITIONS: Record<SlotKind, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  BENCH: ["QB", "RB", "WR", "TE", "K", "DEF"],
};

const SLOT_KINDS = Object.keys(SLOT_KIND_POSITIONS) as SlotKind[];

interface SlotRow {
  key: number;
  kind: SlotKind;
  slotName: string;
}

const MAIN_TEMPLATE: Omit<SlotRow, "key">[] = [
  { kind: "QB", slotName: "QB" },
  { kind: "RB", slotName: "RB1" },
  { kind: "RB", slotName: "RB2" },
  { kind: "WR", slotName: "WR1" },
  { kind: "WR", slotName: "WR2" },
  { kind: "TE", slotName: "TE" },
  { kind: "FLEX", slotName: "FLEX" },
  { kind: "K", slotName: "K" },
  { kind: "DEF", slotName: "DEF" },
  { kind: "BENCH", slotName: "BENCH 1" },
  { kind: "BENCH", slotName: "BENCH 2" },
  { kind: "BENCH", slotName: "BENCH 3" },
  { kind: "BENCH", slotName: "BENCH 4" },
  { kind: "BENCH", slotName: "BENCH 5" },
  { kind: "BENCH", slotName: "BENCH 6" },
];

let nextKey = 1;

export default function SetupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [teamNames, setTeamNames] = useState<string[]>(
    Array.from({ length: 12 }, () => "")
  );
  const [slots, setSlots] = useState<SlotRow[]>(
    MAIN_TEMPLATE.map((s) => ({ ...s, key: nextKey++ }))
  );

  function updateTeamName(index: number, value: string) {
    setTeamNames((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function moveTeam(index: number, direction: -1 | 1) {
    setTeamNames((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeTeam(index: number) {
    setTeamNames((prev) => prev.filter((_, i) => i !== index));
  }

  function addTeam() {
    setTeamNames((prev) => [...prev, ""]);
  }

  function randomizeTeamOrder() {
    setTeamNames((prev) => {
      // Fisher-Yates - unbiased, unlike the common `sort(() => Math.random() - 0.5)`
      // trick, which skews toward certain permutations.
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  function updateSlot(index: number, patch: Partial<SlotRow>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function moveSlot(index: number, direction: -1 | 1) {
    setSlots((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function addSlot() {
    setSlots((prev) => [...prev, { key: nextKey++, kind: "BENCH", slotName: "BENCH" }]);
  }

  function loadMainTemplate() {
    setSlots(MAIN_TEMPLATE.map((s) => ({ ...s, key: nextKey++ })));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createLeagueAndMainPhase({
          leagueName,
          teamNames,
          rosterSlots: slots.map((s) => ({
            slotName: s.slotName,
            eligiblePositions: SLOT_KIND_POSITIONS[s.kind],
            isBench: s.kind === "BENCH",
          })),
        });
        if (result?.phaseId) {
          router.push("/commish/board");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">League name</label>
        <input
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="e.g. The League"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Teams (draft order)</h2>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={randomizeTeamOrder}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              🎲 Randomize order
            </button>
            <button
              type="button"
              onClick={addTeam}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add team
            </button>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          Reorder manually with the arrows below, or randomize the whole
          order at once.
        </p>
        <ol className="flex flex-col gap-2">
          {teamNames.map((name, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm text-zinc-500">
                {index + 1}.
              </span>
              <input
                className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={name}
                onChange={(e) => updateTeamName(index, e.target.value)}
                placeholder={`Team ${index + 1} name`}
              />
              <button
                type="button"
                onClick={() => moveTeam(index, -1)}
                disabled={index === 0}
                className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-zinc-700"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveTeam(index, 1)}
                disabled={index === teamNames.length - 1}
                className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-zinc-700"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeTeam(index)}
                className="rounded border border-red-300 px-2 py-1 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Roster slots (in draft order)</h2>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={loadMainTemplate}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset to standard template
            </button>
            <button
              type="button"
              onClick={addSlot}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add slot
            </button>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          One round is drafted per slot, in this order — {slots.length} slots
          means {slots.length} rounds.
        </p>
        <ol className="flex flex-col gap-2">
          {slots.map((slot, index) => (
            <li key={slot.key} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm text-zinc-500">
                {index + 1}.
              </span>
              <select
                className="rounded border border-zinc-300 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={slot.kind}
                onChange={(e) =>
                  updateSlot(index, { kind: e.target.value as SlotKind })
                }
              >
                {SLOT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={slot.slotName}
                onChange={(e) => updateSlot(index, { slotName: e.target.value })}
                placeholder="Slot label, e.g. RB1"
              />
              <button
                type="button"
                onClick={() => moveSlot(index, -1)}
                disabled={index === 0}
                className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-zinc-700"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSlot(index, 1)}
                disabled={index === slots.length - 1}
                className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-zinc-700"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeSlot(index)}
                className="rounded border border-red-300 px-2 py-1 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      </div>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Creating..." : "Create league & start Main draft"}
      </button>
    </form>
  );
}
