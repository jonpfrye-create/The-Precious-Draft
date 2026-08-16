"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GRADES, gradeColor } from "@/lib/draft/grades";
import { splitTeamName } from "@/lib/teams/branding";
import { saveGrade } from "./actions";
import ClamsPanel, { type ClamsState } from "./ClamsPanel";
import { ACTION_FAILED } from "@/lib/errors";

export interface RosterLine {
  slotName: string;
  playerName: string | null;
  position: string | null;
  nflTeam: string | null;
  round: number | null;
  pickInRound: number | null;
  overall: number | null;
  adp: number | null;
}

/** Round and pick, written the way ADP is - 1.02 is round one, pick two. */
function pickLabel(line: RosterLine): string | null {
  if (line.round === null || line.pickInRound === null) return null;
  return `${line.round}.${String(line.pickInRound).padStart(2, "0")}`;
}

export default function GradeCard({
  phaseId,
  teamId,
  teamName,
  roster,
  initialGrade,
  initialComment,
  clams,
}: {
  phaseId: string;
  teamId: string;
  teamName: string;
  roster: RosterLine[];
  initialGrade: string | null;
  initialComment: string | null;
  clams: ClamsState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [grade, setGrade] = useState(initialGrade ?? "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the server is known to hold. Derived rather than tracked with a
  // flag, so typing something and then deleting it back to the original
  // correctly counts as no change - a stored flag would stay stuck on
  // "Saving..." forever in that case.
  const [savedComment, setSavedComment] = useState(initialComment ?? "");
  const dirty = comment !== savedComment;

  const { teamName: name, manager } = splitTeamName(teamName);

  function persist(
    nextGrade: string,
    nextComment: string,
    { refresh = true }: { refresh?: boolean } = {}
  ) {
    if (!nextGrade) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveGrade(phaseId, teamId, nextGrade, nextComment);
        if (!result.ok) {
          setError(result.error ?? "Couldn't save that.");
          return;
        }
        setSavedComment(nextComment);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        // Autosaves skip the refresh: nothing the server renders changes
        // when a comment's text changes, and re-fetching this page pulls
        // every pick and player for the phase - once per typing pause.
        if (refresh) router.refresh();
      } catch {
        setError(ACTION_FAILED);
      }
    });
  }

  // Save a moment after typing stops, rather than only when the box loses
  // focus. Blur-only means a comment written and then left on screen is
  // never written down, which has already nearly cost this league real
  // work twice - and on draft night nobody is going to notice.
  useEffect(() => {
    if (!grade || !dirty) return;
    const timer = setTimeout(() => {
      persist(grade, comment, { refresh: false });
    }, 1200);
    return () => clearTimeout(timer);
    // persist is recreated every render; depending on it would reset the
    // timer on each keystroke and never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, grade, dirty]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{name}</h2>
          {manager && (
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              {manager}
            </p>
          )}
        </div>
        {grade && (
          <span
            className={`rounded-lg border-2 px-4 py-2 text-2xl font-black ${gradeColor(grade)}`}
          >
            {grade}
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-0.5 text-sm">
        {roster.map((line, index) => {
          const label = pickLabel(line);
          // Positive means taken ahead of the market.
          const vsAdp =
            line.adp !== null && line.overall !== null
              ? Math.round(line.adp - line.overall)
              : null;
          return (
            <li key={index} className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-mono text-xs uppercase text-zinc-500">
                {line.slotName}
              </span>
              <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-zinc-400">
                {label ?? ""}
              </span>
              <span className={line.playerName ? "" : "text-zinc-400"}>
                {line.playerName ?? "—"}
                {line.nflTeam && (
                  <span className="text-zinc-500"> ({line.nflTeam})</span>
                )}
                {vsAdp !== null && Math.abs(vsAdp) >= 8 && (
                  <span
                    className={`ml-2 font-mono text-xs ${
                      vsAdp > 0
                        ? "text-amber-700 dark:text-amber-500"
                        : "text-emerald-700 dark:text-emerald-500"
                    }`}
                  >
                    {vsAdp > 0 ? `+${vsAdp} early` : `${-vsAdp} late`}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {GRADES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={isPending}
            onClick={() => {
              setGrade(option);
              persist(option, comment);
            }}
            className={`rounded border px-2 py-1 text-sm font-bold disabled:opacity-40 ${
              grade === option
                ? gradeColor(option)
                : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        // Kept alongside the autosave as a backstop: clicking away saves
        // immediately rather than waiting out the pause.
        onBlur={() => {
          if (dirty) persist(grade, comment);
        }}
        placeholder="Why?"
        rows={2}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <div className="min-h-[1.25rem] text-sm">
        {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
        {!error && dirty && !grade && (
          <span className="text-amber-700 dark:text-amber-500">
            Pick a grade and this saves with it.
          </span>
        )}
        {!error && dirty && grade && (
          <span className="text-zinc-400">Saving…</span>
        )}
        {!error && !dirty && saved && (
          <span className="text-green-700 dark:text-green-400">Saved</span>
        )}
      </div>

      <ClamsPanel
        phaseId={phaseId}
        teamId={teamId}
        state={clams}
        commissionerGrade={grade || null}
      />
    </div>
  );
}
