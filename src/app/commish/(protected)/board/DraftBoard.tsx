"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  League,
  Phase,
  Pick,
  Player,
  RosterSlot,
  Team,
} from "@/lib/draft/queries";
import { generateSnakeOrder, currentPick } from "@/lib/draft/snake-order";
import { positionColor, POSITIONS } from "@/lib/positions";
import { makePick, undoLastPick } from "./actions";

interface DraftBoardProps {
  league: League;
  leagueCode: string;
  phase: Phase;
  teams: Team[];
  rosterSlots: RosterSlot[];
  picks: Pick[];
  pickedPlayers: Player[];
  availablePlayers: Player[];
}

export default function DraftBoard({
  league,
  leagueCode,
  phase,
  teams,
  picks,
  pickedPlayers,
  availablePlayers,
}: DraftBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");

  const snakeOrder = useMemo(
    () => generateSnakeOrder(teams.map((t) => t.id), phase.rounds),
    [teams, phase.rounds]
  );
  const onClockPick = currentPick(snakeOrder, picks.length);
  const onClockTeam = onClockPick
    ? teams.find((t) => t.id === onClockPick.teamId) ?? null
    : null;

  const playerById = useMemo(
    () => new Map(pickedPlayers.map((p) => [p.player_id, p])),
    [pickedPlayers]
  );
  const pickByRoundAndTeam = useMemo(
    () => new Map(picks.map((p) => [`${p.round}:${p.team_id}`, p])),
    [picks]
  );

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availablePlayers.filter((p) => {
      if (positionFilter !== "ALL" && p.position !== positionFilter) return false;
      if (term && !p.full_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [availablePlayers, search, positionFilter]);

  function handleDraft(player: Player) {
    if (!onClockTeam) return;
    const confirmed = window.confirm(
      `Draft ${player.full_name} (${player.position ?? "?"}) for ${onClockTeam.name}?`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await makePick(phase.id, player.player_id);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to make pick");
      }
    });
  }

  function handleUndo() {
    const confirmed = window.confirm("Undo the most recent pick?");
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await undoLastPick(phase.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to undo");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-50 p-6 dark:bg-black">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{league.name}</h1>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            {phase.type} draft
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            League code:{" "}
            <span className="font-mono tracking-widest text-zinc-700 dark:text-zinc-300">
              {leagueCode}
            </span>{" "}
            <Link
              href="/commish/access"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Codes &amp; links
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {phase.status === "completed" ? (
            <span className="rounded bg-green-600 px-4 py-2 font-medium text-white">
              Draft complete
            </span>
          ) : (
            <span className="rounded bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black">
              On the clock: {onClockTeam?.name}
            </span>
          )}
          <button
            onClick={handleUndo}
            disabled={isPending || picks.length === 0}
            className="rounded border border-red-300 px-4 py-2 text-red-600 disabled:opacity-30 dark:border-red-800 dark:text-red-400"
          >
            Undo last pick
          </button>
        </div>
      </header>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-zinc-100 p-2 text-left dark:bg-zinc-900">
                Rd
              </th>
              {teams.map((team) => (
                <th
                  key={team.id}
                  className="border-l border-zinc-200 bg-zinc-100 p-2 text-left dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {team.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: phase.rounds }, (_, i) => i + 1).map((round) => (
              <tr key={round}>
                <td className="sticky left-0 bg-zinc-50 p-2 font-medium dark:bg-black">
                  {round}
                </td>
                {teams.map((team) => {
                  const pick = pickByRoundAndTeam.get(`${round}:${team.id}`);
                  const player = pick ? playerById.get(pick.player_id) : null;
                  const isOnClock =
                    onClockPick &&
                    onClockPick.round === round &&
                    onClockPick.teamId === team.id;
                  return (
                    <td
                      key={team.id}
                      className="border-l border-t border-zinc-200 p-1 align-top dark:border-zinc-800"
                    >
                      {player ? (
                        <div
                          className={`rounded border px-2 py-1 ${positionColor(player.position)}`}
                        >
                          <div className="font-medium">{player.full_name}</div>
                          <div className="text-xs opacity-70">
                            {player.position}
                            {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                          </div>
                        </div>
                      ) : isOnClock ? (
                        <div className="animate-pulse rounded border-2 border-dashed border-black px-2 py-1 text-center text-xs font-semibold dark:border-white">
                          ON THE CLOCK
                        </div>
                      ) : (
                        <div className="px-2 py-1 text-zinc-300 dark:text-zinc-700">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {phase.status !== "completed" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="min-w-[200px] flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div className="flex gap-1">
              {["ALL", ...POSITIONS].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`rounded px-3 py-2 text-sm ${
                    positionFilter === pos
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded border border-zinc-200 dark:border-zinc-800">
            {filteredPlayers.slice(0, 200).map((player) => (
              <div
                key={player.player_id}
                className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${positionColor(player.position)}`}
                  >
                    {player.position ?? "?"}
                  </span>
                  <span className="font-medium">{player.full_name}</span>
                  {player.nfl_team && (
                    <span className="text-sm text-zinc-500">
                      {player.nfl_team}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDraft(player)}
                  disabled={isPending || !onClockTeam}
                  className="rounded bg-black px-3 py-1 text-sm font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black"
                >
                  Draft
                </button>
              </div>
            ))}
            {filteredPlayers.length === 0 && (
              <p className="p-3 text-zinc-500">No players match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
