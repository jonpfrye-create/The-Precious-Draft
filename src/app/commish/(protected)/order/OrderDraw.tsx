"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Phase, Team } from "@/lib/draft/queries";
import {
  isPositionRevealed,
  REDRAW_CONFIRMATION,
} from "@/lib/draft/order-draw";
import { drawDraftOrder, revealNextPosition } from "./actions";

interface Announcement {
  teamName: string;
  draftPosition: number;
}

// How long the big card sits on screen before it drops into the list. The
// commissioner controls the pace between picks; this is just the length of
// the slam itself.
const CARD_HOLD_MS = 2600;
const FINALE_HOLD_MS = 4200;
// Gap between pick 2 landing and pick 1 following it. Long enough for the
// room to do the arithmetic themselves, which is the whole point.
const FINALE_GAP_MS = 1800;

export default function OrderDraw({
  phase,
  teams,
  picksMade,
}: {
  phase: Phase;
  teams: Team[];
  picksMade: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [showRedraw, setShowRedraw] = useState(false);

  // Cards currently on the stage. Driven by the action's response so the
  // animation and the database never disagree about who was just named.
  const [stage, setStage] = useState<Announcement[]>([]);
  const [stageIsFinale, setStageIsFinale] = useState(false);

  const hasBeenDrawn = phase.order_drawn_at !== null;
  const isLocked = picksMade > 0;
  const total = teams.length;
  const revealedCount = phase.order_revealed_count;
  const fullyRevealed = hasBeenDrawn && revealedCount >= total;
  const midReveal = hasBeenDrawn && revealedCount < total;

  function handleDraw(isRedraw: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await drawDraftOrder(
          phase.id,
          isRedraw ? confirmation : undefined
        );
        if (!result.ok) {
          setError(result.error ?? "The draw failed.");
          return;
        }
        setStage([]);
        setStageIsFinale(false);
        setConfirmation("");
        setShowRedraw(false);
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection.");
      }
    });
  }

  function handleReveal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await revealNextPosition(phase.id);
        if (!result.ok || !result.revealed) {
          setError(result.error ?? "Couldn't reveal the next pick.");
          return;
        }
        const [first, second] = result.revealed;
        setStageIsFinale(Boolean(result.isFinale));

        if (result.isFinale && second) {
          // Pick 2 lands alone first. The room works out pick 1 from who's
          // left, and then pick 1 confirms it.
          setStage([first]);
          setTimeout(() => setStage([first, second]), FINALE_GAP_MS);
          setTimeout(() => {
            setStage([]);
            router.refresh();
          }, FINALE_GAP_MS + FINALE_HOLD_MS);
        } else {
          setStage([first]);
          setTimeout(() => {
            setStage([]);
            router.refresh();
          }, CARD_HOLD_MS);
        }
      } catch {
        setError("Couldn't reach the server. Check your connection.");
      }
    });
  }

  const nextPositionLabel = (() => {
    if (revealedCount === total - 2) return "Reveal picks 2 and 1";
    return `Reveal pick ${total - revealedCount}`;
  })();

  const sortedTeams = [...teams].sort(
    (a, b) => a.draft_position - b.draft_position
  );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {stage.length > 0 && (
        <Stage announcements={stage} isFinale={stageIsFinale} />
      )}

      {!hasBeenDrawn && (
        <div className="rounded border border-amber-400 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-medium">The draft order hasn&apos;t been drawn yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The list below is just the order teams were typed in at setup — it
            means nothing. Draw the real order when everyone&apos;s together.
          </p>
        </div>
      )}

      {fullyRevealed && (
        <div className="rounded border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-medium">Draft order is set.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <DrawnAt iso={phase.order_drawn_at!} />
            {phase.order_draw_count > 1 && (
              <>
                {" — "}
                <span className="font-semibold text-amber-700 dark:text-amber-500">
                  redrawn {phase.order_draw_count - 1}{" "}
                  {phase.order_draw_count - 1 === 1 ? "time" : "times"}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {sortedTeams.map((team) => {
          const shown =
            !hasBeenDrawn ||
            isPositionRevealed(total, revealedCount, team.draft_position);
          return (
            <li
              key={team.id}
              className={`flex items-center gap-4 rounded border p-4 transition-all duration-700 ${
                shown
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  : "border-dashed border-zinc-300 bg-transparent dark:border-zinc-700"
              } ${team.draft_position === 1 && shown && hasBeenDrawn ? "ring-2 ring-amber-400" : ""}`}
            >
              <span className="w-12 text-right text-3xl font-bold tabular-nums text-zinc-300 dark:text-zinc-700">
                {team.draft_position}
              </span>
              <span
                className={`text-xl font-medium transition-opacity duration-700 ${
                  shown ? "opacity-100" : "opacity-0"
                }`}
              >
                {shown ? team.name : "—"}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLocked ? (
        <p className="rounded border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          The draft has started, so the order is locked for good. Changing it
          now would strand picks that have already been made.
        </p>
      ) : !hasBeenDrawn ? (
        <button
          type="button"
          onClick={() => handleDraw(false)}
          disabled={isPending}
          className="self-start rounded bg-black px-8 py-5 text-xl font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "Drawing..." : "🎲 Draw the draft order"}
        </button>
      ) : midReveal ? (
        <button
          type="button"
          onClick={handleReveal}
          disabled={isPending || stage.length > 0}
          className="self-start rounded bg-amber-500 px-8 py-5 text-xl font-semibold text-black disabled:opacity-40"
        >
          {stage.length > 0 ? "..." : nextPositionLabel}
        </button>
      ) : showRedraw ? (
        <div className="flex flex-col gap-3 rounded border border-amber-400 p-5 dark:border-amber-700">
          <p className="font-medium">Redraw the order?</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This throws away the order above and draws a new one. The board
            will show that the order was redrawn, and how many times — there
            is no way to do this quietly.
          </p>
          <label className="text-sm" htmlFor="redraw-confirm">
            Type{" "}
            <span className="font-mono font-semibold">
              {REDRAW_CONFIRMATION}
            </span>{" "}
            to confirm:
          </label>
          <input
            id="redraw-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-48 rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
            autoComplete="off"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleDraw(true)}
              disabled={
                isPending ||
                confirmation.trim().toUpperCase() !== REDRAW_CONFIRMATION
              }
              className="rounded bg-amber-600 px-5 py-3 font-medium text-white disabled:opacity-40"
            >
              {isPending ? "Redrawing..." : "Redraw the order"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRedraw(false);
                setConfirmation("");
                setError(null);
              }}
              className="rounded border border-zinc-300 px-5 py-3 dark:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowRedraw(true)}
          className="self-start text-sm text-zinc-500 hover:underline"
        >
          Something went wrong — redraw the order
        </button>
      )}

      <Link
        href="/commish/board"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to the draft board
      </Link>
    </div>
  );
}

// The full-screen moment. Sits above everything, so from across the room
// there is exactly one thing to look at.
function Stage({
  announcements,
  isFinale,
}: {
  announcements: Announcement[];
  isFinale: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/95 px-8">
      {announcements.map((a) => {
        const isTopPick = a.draftPosition === 1;
        return (
          <div
            key={a.draftPosition}
            className="animate-slam flex flex-col items-center gap-3 text-center"
          >
            <span
              className={`text-2xl font-bold uppercase tracking-[0.3em] ${
                isTopPick ? "text-amber-400" : "text-zinc-500"
              }`}
            >
              {isTopPick ? "First pick" : `Pick ${a.draftPosition}`}
            </span>
            <span
              className={`text-6xl font-black leading-tight md:text-8xl ${
                isTopPick ? "text-amber-300" : "text-white"
              }`}
            >
              {a.teamName}
            </span>
          </div>
        );
      })}
      {isFinale && announcements.length === 1 && (
        <p className="animate-pulse text-lg uppercase tracking-widest text-zinc-500">
          which means...
        </p>
      )}
    </div>
  );
}

// Never changes, so subscribing is a no-op - this is only here to give
// useSyncExternalStore the shape it wants.
const subscribeToNothing = () => () => {};

// The timestamp has to be formatted in the viewer's timezone, which the
// server doesn't know. useSyncExternalStore renders the server placeholder
// during hydration and swaps to local time immediately after, without the
// hydration mismatch that formatting on both sides would cause.
function DrawnAt({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  return <>Drawn {isClient ? new Date(iso).toLocaleString() : "…"}</>;
}
