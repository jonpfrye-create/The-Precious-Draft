"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Phase, Team } from "@/lib/draft/queries";
import {
  isPositionRevealed,
  REDRAW_CONFIRMATION,
} from "@/lib/draft/order-draw";
import {
  splitTeamName,
  teamInitials,
  TEAM_PALETTE,
  type TeamColor,
} from "@/lib/teams/branding";
import { pickNumbersForPosition } from "@/lib/draft/snake-order";
import { playFanfare, playStinger, playSuspense } from "@/lib/audio/fanfare";
import Confetti from "./Confetti";
import { drawDraftOrder, revealNextPosition } from "./actions";

interface Announcement {
  teamName: string;
  draftPosition: number;
  color: TeamColor;
  pickNumbers: number[];
}

// How long the big card sits on screen before it drops into the list. The
// commissioner controls the pace between picks; this is just the length of
// the slam itself.
const CARD_HOLD_MS = 2600;
// The finale runs as long as the confetti does, so the room isn't left
// looking at a bare list while pieces are still falling.
const FINALE_HOLD_MS = 8000;

export default function OrderDraw({
  phase,
  teams,
  picksMade,
  colorByTeamId,
}: {
  phase: Phase;
  teams: Team[];
  picksMade: number;
  colorByTeamId: Record<string, TeamColor>;
}) {
  // Falls back to the first palette entry rather than crashing if a team
  // somehow arrives without a colour.
  const colorFor = (teamId: string): TeamColor =>
    colorByTeamId[teamId] ?? TEAM_PALETTE[0];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [showRedraw, setShowRedraw] = useState(false);

  // Cards currently on the stage. Driven by the action's response so the
  // animation and the database never disagree about who was just named.
  const [stage, setStage] = useState<Announcement[]>([]);
  const [muted, setMuted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

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
        // The action returns names and positions; colour comes from the
        // league-wide assignment held on this page.
        const teamIdByPosition = new Map(
          teams.map((t) => [t.draft_position, t.id])
        );
        const [announced] = result.revealed.map((r) => ({
          ...r,
          color: colorFor(teamIdByPosition.get(r.draftPosition) ?? ""),
          pickNumbers: pickNumbersForPosition(
            total,
            phase.rounds,
            r.draftPosition
          ),
        }));

        setStage([announced]);
        const finale = Boolean(result.isFinale);

        if (finale) {
          setCelebrating(true);
          if (!muted) playFanfare();
          setTimeout(() => {
            setStage([]);
            setCelebrating(false);
            router.refresh();
          }, FINALE_HOLD_MS);
        } else {
          const tension = total > 1 ? (result.revealedCount ?? 1) / (total - 1) : 1;
          if (!muted) playStinger(Math.min(tension, 1));
          setTimeout(() => {
            setStage([]);
            router.refresh();
            // Revealing pick 2 leaves one team standing. The suspense drone
            // starts as the card clears, under the "one team remains" panel.
            if (result.setsUpFinale && !muted) playSuspense();
          }, CARD_HOLD_MS);
        }
      } catch {
        setError("Couldn't reach the server. Check your connection.");
      }
    });
  }

  // One pick away from the end: the room already knows who it is, so the
  // button says so rather than just counting down.
  const onePickLeft = hasBeenDrawn && revealedCount === total - 1;
  const nextPositionLabel = onePickLeft
    ? "🏆 Reveal the first pick"
    : `Reveal pick ${total - revealedCount}`;

  const sortedTeams = [...teams].sort(
    (a, b) => a.draft_position - b.draft_position
  );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {stage.length > 0 && (
        <Stage announcements={stage} />
      )}
      {celebrating && (
        <Confetti
          accent={
            stage.find((a) => a.draftPosition === 1)?.color.hex ?? "#FCD34D"
          }
        />
      )}

      {!isLocked && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="self-end text-sm text-zinc-500 hover:underline"
          aria-pressed={muted}
        >
          {muted ? "🔇 Sound off" : "🔊 Sound on"}
        </button>
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
          const color = colorFor(team.id);
          const { teamName, manager } = splitTeamName(team.name);
          const isTopPick = team.draft_position === 1 && hasBeenDrawn;

          return (
            <li
              key={team.id}
              className={`flex items-center gap-4 overflow-hidden rounded border p-4 transition-all duration-700 ${
                shown
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  : "border-dashed border-zinc-300 bg-transparent dark:border-zinc-700"
              } ${isTopPick && shown ? "ring-2 ring-amber-400" : ""}`}
            >
              <span className="w-10 text-right text-3xl font-bold tabular-nums text-zinc-300 dark:text-zinc-700">
                {team.draft_position}
              </span>
              {/* Colour chip doubles as the team's identity everywhere else */}
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black transition-opacity duration-700"
                style={{
                  backgroundColor: shown ? color.hex : "transparent",
                  color: color.onHex,
                  opacity: shown ? 1 : 0,
                }}
              >
                {shown ? teamInitials(team.name) : ""}
              </span>
              <span
                className={`flex flex-col transition-opacity duration-700 ${
                  shown ? "opacity-100" : "opacity-0"
                }`}
              >
                <span className="text-xl font-semibold leading-tight">
                  {shown ? teamName : "—"}
                </span>
                {shown && manager && (
                  <span className="text-sm uppercase tracking-widest text-zinc-500">
                    {manager}
                  </span>
                )}
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
        <div className="flex flex-col gap-4">
          {onePickLeft && stage.length === 0 && (
            <div className="animate-suspense rounded-lg border-2 border-amber-400 bg-amber-50 p-6 text-center dark:bg-amber-950/40">
              <p className="text-3xl font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                One team remains
              </p>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {total - 1} picks are on the board. Everyone in the room
                already knows who has the first pick — make them say it out
                loud before you click.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleReveal}
            disabled={isPending || stage.length > 0}
            className={`self-start rounded px-8 py-5 text-xl font-semibold disabled:opacity-40 ${
              onePickLeft
                ? "animate-pulse bg-amber-400 text-black shadow-lg shadow-amber-500/40"
                : "bg-amber-500 text-black"
            }`}
          >
            {stage.length > 0 ? "..." : nextPositionLabel}
          </button>
        </div>
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
function Stage({ announcements }: { announcements: Announcement[] }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-[#05060A] px-6">
      {announcements.map((a) => (
        <AnnouncementCard key={a.draftPosition} announcement={a} />
      ))}
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const { teamName, manager } = splitTeamName(announcement.teamName);
  const initials = teamInitials(announcement.teamName);
  const color = announcement.color;
  const isTopPick = announcement.draftPosition === 1;

  return (
    <div className="animate-slam relative flex w-full max-w-5xl flex-col items-center">
      {/* Team-coloured wash behind the card, so the whole screen takes on
          the team's colour rather than it being a small accent. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 -z-10 blur-3xl ${
          isTopPick ? "opacity-45" : "opacity-25"
        }`}
        style={{
          background: `radial-gradient(circle at 50% 45%, ${color.hex} 0%, transparent 68%)`,
        }}
      />

      {/* Pick number strap */}
      <div className="mb-5 flex items-center gap-4">
        <span
          className="h-1.5 w-16 rounded-full"
          style={{ backgroundColor: color.hex }}
        />
        <span
          className={`font-bold uppercase tracking-[0.35em] text-2xl`}
          style={{ color: isTopPick ? "#FCD34D" : color.hex }}
        >
          {isTopPick ? "First pick" : `Pick ${announcement.draftPosition}`}
        </span>
        <span
          className="h-1.5 w-16 rounded-full"
          style={{ backgroundColor: color.hex }}
        />
      </div>

      <div className="flex items-center gap-6">
        {/* Monogram plate standing in for a team logo */}
        <div
          className={`flex shrink-0 items-center justify-center rounded-2xl font-black shadow-2xl h-32 w-32 text-5xl md:h-40 md:w-40 md:text-6xl`}
          style={{ backgroundColor: color.hex, color: color.onHex }}
        >
          {initials}
        </div>

        <div className="flex flex-col text-left">
          <span
            className={`font-black uppercase leading-[0.95] tracking-tight text-white text-5xl md:text-7xl lg:text-8xl`}
          >
            {teamName}
          </span>
          {manager && (
            <span
              className={`mt-2 font-semibold uppercase tracking-[0.3em] text-xl md:text-2xl`}
              style={{ color: color.hex }}
            >
              {manager}
            </span>
          )}
        </div>
      </div>

      {/* Lower-third bar: every overall pick this slot owns, all rounds. */}
      <div className="mt-8 flex w-full items-stretch overflow-hidden rounded-lg shadow-2xl">
        <div
          className="flex items-center px-6 font-black tabular-nums"
          style={{ backgroundColor: color.hex, color: color.onHex }}
        >
          <span className="text-3xl">{announcement.draftPosition}</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 bg-white/10 px-6 py-3 backdrop-blur">
          <span className="shrink-0 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Picks
          </span>
          {/* Wraps rather than truncates - all fourteen rounds are on
              screen, which is the first thing everyone wants to know. */}
          {announcement.pickNumbers.map((pick) => (
            <span
              key={pick}
              className="text-lg font-bold tabular-nums text-zinc-100"
            >
              {pick}
            </span>
          ))}
        </div>
      </div>
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
