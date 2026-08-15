"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PHASE_LABELS, type PhaseType } from "@/lib/draft/phase-templates";
import { scarcityWarnings } from "@/lib/draft/scarcity";
import { splitTeamName } from "@/lib/teams/branding";
import { startNextPhase, type StartPhaseSlotInput } from "./actions";

interface TeamOption {
  id: string;
  name: string;
  playedPrevious: boolean;
}

export default function NextPhaseForm({
  phaseType,
  previousPhaseLabel,
  teams,
  defaultSlots,
  availableByPosition,
}: {
  phaseType: PhaseType;
  previousPhaseLabel: string;
  teams: TeamOption[];
  defaultSlots: StartPhaseSlotInput[];
  availableByPosition: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Pre-checked with whoever played the previous phase. The room decides
  // who's staying, and the commissioner only has to untick the leavers -
  // people are standing around waiting while this happens.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(teams.filter((t) => t.playedPrevious).map((t) => t.id))
  );
  const [slots, setSlots] = useState<StartPhaseSlotInput[]>(defaultSlots);
  const [editingSlots, setEditingSlots] = useState(false);

  function toggle(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startNextPhase({
          teamIds: [...selected],
          rosterSlots: slots,
        });
        if (!result.ok) {
          setError(result.error ?? "Couldn't start the phase.");
          return;
        }
        // Straight to the order draw - the new phase has a placeholder
        // order until it's drawn in front of everyone.
        //
        // No router.refresh() here. It re-fetches the page being left,
        // which now redirects to the board and pulls the whole player
        // pool - so it raced the push inside the same transition and the
        // button sat on "Starting..." while nothing appeared to happen.
        // push() already fetches the destination fresh.
        router.push("/commish/order");
      } catch {
        setError("Couldn't reach the server. Check your connection.");
      }
    });
  }

  const label = PHASE_LABELS[phaseType];

  // Recomputed as teams are ticked and slots edited, because both change
  // the answer. A quarterback shortage only appears once you know how many
  // teams are staying.
  const warnings = scarcityWarnings(
    slots.map((slot) => ({
      slotName: slot.slotName,
      eligiblePositions: slot.eligiblePositions,
    })),
    selected.size,
    availableByPosition
  );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-zinc-500">
          {previousPhaseLabel} is complete
        </p>
        <h1 className="text-4xl font-semibold">Start {label}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {/* Explicit {" "}: JSX trims the leading space of a text chunk
              that spans more than one line, which rendered this as
              "played Mainis ticked". */}
          Everyone who played {previousPhaseLabel}{" "}
          is ticked. Untick anyone who&apos;s not sticking around.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Who&apos;s in? ({selected.size} of {teams.length})
          </h2>
          <div className="flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setSelected(new Set(teams.map((t) => t.id)))}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-1">
          {teams.map((team) => {
            const { teamName, manager } = splitTeamName(team.name);
            const checked = selected.has(team.id);
            return (
              <li key={team.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded border p-3 transition-colors ${
                    checked
                      ? "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                      : "border-dashed border-zinc-300 opacity-50 dark:border-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(team.id)}
                    className="h-5 w-5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{teamName}</span>
                    {manager && (
                      <span className="text-sm uppercase tracking-widest text-zinc-500">
                        {manager}
                      </span>
                    )}
                  </span>
                  {!team.playedPrevious && (
                    <span className="ml-auto text-xs italic text-zinc-500">
                      didn&apos;t play {previousPhaseLabel}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Roster — {slots.length} rounds
          </h2>
          <button
            type="button"
            onClick={() => setEditingSlots((v) => !v)}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {editingSlots ? "Done editing" : "Change roster"}
          </button>
        </div>

        {editingSlots ? (
          <div className="flex flex-col gap-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
            {slots.map((slot, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={slot.slotName}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((s, i) =>
                        i === index ? { ...s, slotName: e.target.value } : s
                      )
                    )
                  }
                  className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span className="text-sm text-zinc-500">
                  {slot.eligiblePositions.join("/")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSlots((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="rounded border border-red-300 px-2 py-1 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSlots(defaultSlots)}
              className="self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset to the standard {label} roster
            </button>
          </div>
        ) : (
          <p className="flex flex-wrap gap-2">
            {slots.map((slot, index) => (
              <span
                key={index}
                className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
              >
                {slot.slotName}
              </span>
            ))}
          </p>
        )}
      </section>

      {warnings.length > 0 && (
        <div className="rounded border-2 border-red-400 bg-red-50 p-5 dark:border-red-700 dark:bg-red-950/40">
          <p className="font-semibold">Not enough players to go round.</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {warnings.map((warning) => (
              <li key={warning.position}>
                <strong>{warning.position}</strong>: {selected.size} teams need{" "}
                {warning.needed}, but only <strong>{warning.available}</strong>{" "}
                {warning.available === 1 ? "is" : "are"} left in the pool.
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            At least one team would be left without a starter. The usual fix
            is to undo the last {warnings[0].position} taken in{" "}
            {previousPhaseLabel} so it returns to the pool, or to drop that
            slot from this phase&apos;s roster. You can still start the phase
            — this is a warning, not a block.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={isPending || selected.size < 2}
        className="self-start rounded bg-black px-8 py-5 text-xl font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {isPending ? "Starting..." : `Start ${label} →`}
      </button>
      <p className="text-sm text-zinc-500">
        Next you&apos;ll draw the {label} draft order, same as Main.
      </p>
    </div>
  );
}
