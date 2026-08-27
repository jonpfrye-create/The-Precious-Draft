"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Confetti from "@/components/Confetti";
import { playFanfare, playStinger } from "@/lib/audio/fanfare";
import { useLeaguePhases } from "@/lib/realtime/useLeaguePhases";
import { splitTeamName } from "@/lib/teams/branding";
import type { LobbyState } from "@/lib/draft/lobby";
import { releaseMyTeam } from "./actions";

export interface RosterEntry {
  id: string;
  name: string;
  here: boolean;
  isMe: boolean;
  hex: string;
}

export interface Slot {
  position: number;
  name: string | null;
  isMe: boolean;
  hex: string | null;
}

/** How often the lobby re-checks who has arrived, in milliseconds. */
const ARRIVALS_POLL_MS = 4000;

/**
 * A slower backstop that runs during the reveal, where realtime is doing
 * the real work.
 *
 * Not redundant. A probe caught the very first subscription of a cold
 * session missing its event while every later one arrived in about
 * 200ms - so a phone unlucky enough to miss the *last* reveal would sit
 * showing a stale order with nothing further coming to correct it. A
 * refresh every ten seconds costs almost nothing and guarantees every
 * screen converges on the truth even if a message is dropped.
 */
const REVEAL_POLL_MS = 10000;

/**
 * How long the finished order stays on screen before the draft takes
 * over.
 *
 * Long enough for the confetti to finish and for twelve people to shout
 * at each other about the first pick. Cutting to the draft board the
 * instant the last slot turns over throws away the moment the whole
 * reveal exists to create.
 */
const FINALE_HOLD_MS = 9000;

export default function LobbyView({
  leagueId,
  leagueName,
  myTeamName,
  state,
  roster,
  slots,
  phaseType,
  canRelease,
}: {
  leagueId: string;
  leagueName: string;
  myTeamName: string;
  // Never "drafting": the page redirects to /draft before rendering
  // this, so the component only has to describe the two states that
  // actually have a waiting room to show.
  state: Exclude<LobbyState, { kind: "drafting" }>;
  roster: RosterEntry[];
  slots: Slot[];
  phaseType: string | null;
  canRelease: boolean;
}) {
  const router = useRouter();
  const revealing = state.kind === "revealing";

  // The reveal and the start of the draft both arrive over realtime -
  // every press writes phases.order_revealed_count, and starting the
  // draft writes phases.status.
  useLeaguePhases(leagueId, () => router.refresh());

  // Arrivals do not. team_claims is RLS-enabled with zero policies
  // because the claim token lives in it and a token *is* a team's
  // identity - so the browser cannot read it and realtime cannot carry
  // it. Polling a server component is the honest way round that. It
  // slows down rather than stopping once the reveal starts, as the
  // backstop described above.
  useEffect(() => {
    const every = revealing ? REVEAL_POLL_MS : ARRIVALS_POLL_MS;
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [revealing, router]);

  const here = roster.filter((r) => r.here).length;
  const { teamName } = splitTeamName(myTeamName);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
          {leagueName}
          {phaseType ? ` · ${phaseType} draft` : ""}
        </p>
        <h1 className="text-3xl font-semibold">
          {revealing ? "Draft order" : "Waiting room"}
        </h1>
        <p className="text-sm text-zinc-500">
          You&apos;re in as <span className="font-semibold">{teamName}</span>.
        </p>
      </header>

      {state.kind === "waiting" ? (
        <Arrivals
          roster={roster}
          here={here}
          everyoneIn={state.everyoneIn}
          canRelease={canRelease}
        />
      ) : (
        <Reveal slots={slots} complete={state.complete} />
      )}
    </main>
  );
}

function Arrivals({
  roster,
  here,
  everyoneIn,
  canRelease,
}: {
  roster: RosterEntry[];
  here: number;
  everyoneIn: boolean;
  canRelease: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-medium">
          {here} of {roster.length} teams here
        </p>
        <p className="text-sm text-zinc-500">
          {everyoneIn
            ? "Everyone's in. The commissioner will draw the order."
            : "Hang tight — the order gets drawn once the league is in."}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {roster.map((t) => {
          const { teamName, manager } = splitTeamName(t.name);
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${
                t.here
                  ? "border-zinc-300 dark:border-zinc-700"
                  : "border-dashed border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: t.here ? t.hex : "transparent",
                         boxShadow: t.here ? "none" : "inset 0 0 0 1.5px #a1a1aa" }}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  t.here ? "" : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                <span className="font-medium">{teamName}</span>
                {manager ? (
                  <span className="text-zinc-500"> · {manager}</span>
                ) : null}
                {t.isMe ? (
                  <span className="text-zinc-500"> (you)</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] uppercase tracking-wider text-zinc-400">
                {t.here ? "Here" : "Waiting"}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The five-past-five problem: wrong row tapped, or someone else got
          to the phone first. Only offered while no pick exists. */}
      {canRelease ? (
        <div className="flex flex-col items-center gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Got the wrong team?</p>
          <button
            type="button"
            disabled={releasing}
            onClick={async () => {
              setReleasing(true);
              setError(null);
              const r = await releaseMyTeam();
              // A success redirects and never returns.
              if (r && !r.ok) {
                setError(r.error ?? null);
                setReleasing(false);
              }
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {releasing ? "Letting go…" : "Give this team back"}
          </button>
          {error ? (
            <p className="text-center text-xs text-red-600">{error}</p>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
          On the wrong team? Ask the commissioner to move you.
        </p>
      )}
    </>
  );
}

function Reveal({ slots, complete }: { slots: Slot[]; complete: boolean }) {
  const router = useRouter();
  const revealed = slots.filter((s) => s.name !== null).length;

  // Finishing the reveal is what starts the draft - there is no separate
  // button for the commissioner to remember. Every phone moves itself
  // once the last slot has turned over and the celebration has had its
  // moment.
  useEffect(() => {
    if (!complete) return;
    const id = setTimeout(() => router.push("/draft"), FINALE_HOLD_MS);
    return () => clearTimeout(id);
  }, [complete, router]);

  // Sound and confetti fire on the change, not on the state - otherwise
  // every poll and every re-render would replay them.
  const previous = useRef(revealed);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (revealed === previous.current) return;
    const isFirstOverall = slots.some((s) => s.position === 1 && s.name);
    previous.current = revealed;

    if (isFirstOverall) {
      playFanfare();
      // Reacting to data that arrived from somebody else's device is the
      // one thing an effect is genuinely for, and there is no event on
      // this phone to hang it off - the commissioner pressed the button,
      // three hundred miles away. The rule is guarding against effects
      // that loop; this one runs only when the revealed count actually
      // changes, and the count only moves forwards.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCelebrating(true);
      const id = setTimeout(() => setCelebrating(false), 6000);
      return () => clearTimeout(id);
    }
    playStinger(Math.min(1, revealed / Math.max(1, slots.length)));
  }, [revealed, slots]);

  const first = slots.find((s) => s.position === 1);

  return (
    <>
      {celebrating ? <Confetti accent={first?.hex ?? "#FCD34D"} /> : null}

      <p className="text-sm text-zinc-500">
        {complete
          ? "That's the order. Taking you to the draft…"
          : `${revealed} of ${slots.length} revealed. Watch this space.`}
      </p>

      <ol className="flex flex-col gap-2">
        {slots.map((s) => (
          <li
            key={s.position}
            className={`flex items-center gap-3 rounded-md border px-3 py-3 transition-colors ${
              s.name
                ? "border-zinc-300 dark:border-zinc-700"
                : "border-dashed border-zinc-200 dark:border-zinc-800"
            }`}
            style={
              s.name && s.isMe
                ? { boxShadow: `inset 0 0 0 2px ${s.hex ?? "#71717a"}` }
                : undefined
            }
          >
            <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-zinc-500">
              {s.position}
            </span>
            {s.name ? (
              <>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.hex ?? "#71717a" }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {splitTeamName(s.name).teamName}
                  {s.isMe ? (
                    <span className="font-normal text-zinc-500"> (you)</span>
                  ) : null}
                </span>
              </>
            ) : (
              <span
                className="h-4 flex-1 rounded bg-zinc-200/70 dark:bg-zinc-800"
                aria-label="Not revealed yet"
              />
            )}
          </li>
        ))}
      </ol>

      {/* Never leave anyone waiting on a timer they can't skip. */}
      <Link
        href="/draft"
        className="self-center rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {complete ? "Go to the draft now" : "Skip to the draft board"}
      </Link>
    </>
  );
}
