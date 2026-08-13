"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Phase, Team } from "@/lib/draft/queries";
import { REDRAW_CONFIRMATION } from "@/lib/draft/order-draw";
import { drawDraftOrder } from "./actions";

interface OrderRow {
  teamId: string;
  teamName: string;
  draftPosition: number;
}

// How long between each team appearing during the reveal. Slow enough to
// build to the first pick, short enough that twelve teams don't outstay
// their welcome.
const REVEAL_INTERVAL_MS = 700;

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

  const hasBeenDrawn = phase.order_drawn_at !== null;
  const isLocked = picksMade > 0;

  const initialRows: OrderRow[] = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    draftPosition: t.draft_position,
  }));
  const [rows, setRows] = useState<OrderRow[]>(initialRows);

  // Positions revealed so far, counted from the last pick upwards. Null
  // means "not mid-reveal" - everything shows at once.
  const [revealedFromBottom, setRevealedFromBottom] = useState<number | null>(
    null
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startReveal(total: number) {
    setRevealedFromBottom(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRevealedFromBottom((prev) => {
        const next = (prev ?? 0) + 1;
        if (next >= total) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Refresh once the reveal finishes so the rest of the app sees the
          // new order without interrupting the animation partway through.
          router.refresh();
          return null;
        }
        return next;
      });
    }, REVEAL_INTERVAL_MS);
  }

  function revealEverythingNow() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRevealedFromBottom(null);
    router.refresh();
  }

  function handleDraw(isRedraw: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await drawDraftOrder(
          phase.id,
          isRedraw ? confirmation : undefined
        );
        if (!result.ok || !result.order) {
          setError(result.error ?? "The draw failed.");
          return;
        }
        setRows(result.order);
        setConfirmation("");
        setShowRedraw(false);
        startReveal(result.order.length);
      } catch {
        setError("Couldn't reach the server. Check your connection.");
      }
    });
  }

  const total = rows.length;
  // Reveal runs from the last pick up to the first, so the room finds out
  // who has the number one pick last.
  function isVisible(draftPosition: number): boolean {
    if (revealedFromBottom === null) return true;
    return draftPosition > total - revealedFromBottom;
  }

  const midReveal = revealedFromBottom !== null;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {!hasBeenDrawn && !midReveal && (
        <div className="rounded border border-amber-400 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-medium">The draft order hasn&apos;t been drawn yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The list below is just the order the teams were typed in at
            setup — it means nothing. Draw the real order when everyone&apos;s
            together.
          </p>
        </div>
      )}

      {hasBeenDrawn && !midReveal && (
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
        {rows
          .slice()
          .sort((a, b) => a.draftPosition - b.draftPosition)
          .map((row) => (
            <li
              key={row.teamId}
              className={`flex items-center gap-4 rounded border p-4 transition-opacity duration-500 ${
                isVisible(row.draftPosition)
                  ? "border-zinc-200 opacity-100 dark:border-zinc-800"
                  : "border-dashed border-zinc-300 opacity-0 dark:border-zinc-700"
              }`}
            >
              <span className="w-10 text-right text-2xl font-semibold tabular-nums text-zinc-400">
                {row.draftPosition}
              </span>
              <span className="text-xl font-medium">
                {isVisible(row.draftPosition) ? row.teamName : ""}
              </span>
            </li>
          ))}
      </ol>

      {midReveal && (
        <button
          type="button"
          onClick={revealEverythingNow}
          className="self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Skip the reveal
        </button>
      )}

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
          disabled={isPending || midReveal}
          className="self-start rounded bg-black px-6 py-4 text-lg font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "Drawing..." : "🎲 Draw the draft order"}
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
            Type <span className="font-mono font-semibold">{REDRAW_CONFIRMATION}</span>{" "}
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
        !midReveal && (
          <button
            type="button"
            onClick={() => setShowRedraw(true)}
            className="self-start text-sm text-zinc-500 hover:underline"
          >
            Something went wrong — redraw the order
          </button>
        )
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
