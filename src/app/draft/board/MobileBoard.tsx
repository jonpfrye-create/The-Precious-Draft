"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { splitTeamName } from "@/lib/teams/branding";
import { usePhaseChannel } from "@/lib/realtime/usePhaseChannel";

export interface BoardTeam {
  id: string;
  name: string;
  draftPosition: number;
  hex: string;
  onHex: string;
}

export interface BoardPick {
  id: string;
  pickNumber: number;
  round: number;
  teamId: string;
  teamName: string;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  hasAdp: boolean;
}

export default function MobileBoard({
  phaseId,
  phaseType,
  rounds,
  myTeamId,
  onClockTeamId,
  picksMade,
  totalPicks,
  teams,
  picks,
}: {
  phaseId: string;
  phaseType: string;
  rounds: number;
  myTeamId: string;
  onClockTeamId: string | null;
  picksMade: number;
  totalPicks: number;
  teams: BoardTeam[];
  picks: BoardPick[];
}) {
  // "Everything" is the feed; a team id is that team's roster. The feed
  // leads because the question a phone gets opened to answer is what just
  // happened.
  const [filter, setFilter] = useState<string>("all");

  // A new pick needs a player name and a team colour that this component
  // has no way to derive, so it refetches - cheap here, at 27 KB.
  const router = useRouter();
  usePhaseChannel(phaseId, () => router.refresh());

  const shown =
    filter === "all" ? picks : picks.filter((p) => p.teamId === filter);

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-bold capitalize">{phaseType} board</h1>
        <span className="font-mono text-xs tabular-nums text-zinc-500">
          {picksMade}/{totalPicks} · {rounds} rounds
        </span>
      </div>

      {/* Team filter. Horizontally scrollable rather than wrapped, so the
          board never pushes the picks off the bottom of the screen. */}
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
            filter === "all"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          Everything
        </button>
        {[...teams]
          .sort((a, b) => a.draftPosition - b.draftPosition)
          .map((team) => {
            const { teamName } = splitTeamName(team.name);
            const active = filter === team.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setFilter(team.id)}
                style={
                  active ? { background: team.hex, color: team.onHex } : undefined
                }
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                  active
                    ? ""
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                }`}
              >
                {team.id === myTeamId ? "You" : teamName.slice(0, 12)}
                {team.id === onClockTeamId && " •"}
              </button>
            );
          })}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          No picks yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {shown.map((pick) => {
            const team = teams.find((t) => t.id === pick.teamId);
            const { teamName } = splitTeamName(pick.teamName);
            return (
              <li
                key={pick.id}
                className="sticker flex items-center gap-3 border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold tabular-nums"
                  style={{ background: team?.hex, color: team?.onHex }}
                >
                  {pick.round}.
                  {String(pick.pickNumber % 100).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate ${
                      pick.hasAdp ? "font-semibold" : "sharpie text-[15px]"
                    }`}
                  >
                    {pick.playerName}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {pick.position}
                    {pick.nflTeam ? ` · ${pick.nflTeam}` : ""} —{" "}
                    {pick.teamId === myTeamId ? "you" : teamName}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
