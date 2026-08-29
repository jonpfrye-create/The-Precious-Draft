"use client";

import { positionColor } from "@/lib/positions";
import { splitTeamName } from "@/lib/teams/branding";
import { stickerStyle } from "@/lib/stickers";
import type { BoardPick, BoardTeam } from "./MobileBoard";

/**
 * The whole board, for anyone drafting on a laptop.
 *
 * `MobileBoard` is the right answer on a phone and the wrong one on a
 * thirteen-inch screen: half the league drafted the practice round from
 * laptops and got a column of picks meant for a thumb. What they wanted
 * was the thing on the television.
 *
 * Read-only, and that is the whole difference from the commissioner's
 * board. No sticker to peel, no undo, no zoom - a drafter picks from
 * "My team", and a board that looked pickable would be a board where
 * twelve people discover one at a time that it isn't.
 */
export default function WideBoard({
  phaseType,
  rounds,
  myTeamId,
  onClockTeamId,
  picksMade,
  totalPicks,
  teams,
  picks,
}: {
  phaseType: string;
  rounds: number;
  myTeamId: string;
  onClockTeamId: string | null;
  picksMade: number;
  totalPicks: number;
  teams: BoardTeam[];
  picks: BoardPick[];
}) {
  // Columns run in draft order; the page hands them over in whatever
  // order the query returned.
  const columns = [...teams].sort((a, b) => a.draftPosition - b.draftPosition);

  const byRoundAndTeam = new Map(
    picks.map((p) => [`${p.round}:${p.teamId}`, p])
  );

  const latest = picks.reduce<BoardPick | null>(
    (best, p) => (!best || p.pickNumber > best.pickNumber ? p : best),
    null
  );

  // The single cell the next pick lands in: the on-clock team's lowest
  // empty round. Marking every empty cell it owns would light up half
  // the column and say nothing.
  const nextRound = onClockTeamId
    ? Array.from({ length: rounds }, (_, i) => i + 1).find(
        (r) => !byRoundAndTeam.has(`${r}:${onClockTeamId}`)
      ) ?? null
    : null;

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold capitalize">{phaseType} board</h1>
        <span className="font-mono text-sm tabular-nums text-zinc-500">
          {picksMade}/{totalPicks} · {rounds} rounds
        </span>
      </div>

      {/* Scrolls inside itself. Twelve columns past a certain round count
          will always be wider than a laptop, and the page must not be the
          thing that scrolls sideways. */}
      <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-100 px-2 py-2 text-right font-mono text-[10px] font-normal text-zinc-500 dark:bg-zinc-900">
                Rd
              </th>
              {columns.map((team) => {
                const { teamName, manager } = splitTeamName(team.name);
                const onClock = team.id === onClockTeamId;
                return (
                  <th
                    key={team.id}
                    className={`min-w-[104px] px-1.5 py-2 text-left align-bottom ${
                      onClock ? "ring-2 ring-inset ring-amber-400" : ""
                    }`}
                    style={{ backgroundColor: team.hex, color: team.onHex }}
                  >
                    <span className="block text-[10px] font-black uppercase tracking-wider opacity-80">
                      {team.draftPosition}
                      {team.id === myTeamId ? " · YOU" : ""}
                    </span>
                    <span className="block truncate text-[11px] font-bold leading-tight">
                      {teamName}
                    </span>
                    {manager && (
                      <span className="block truncate text-[9px] uppercase tracking-widest opacity-75">
                        {manager}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
              <tr key={round}>
                <td className="sticky left-0 z-10 bg-zinc-100 px-2 py-1 text-right font-mono text-[10px] tabular-nums text-zinc-500 dark:bg-zinc-900">
                  {round}
                </td>
                {columns.map((team) => {
                  const pick = byRoundAndTeam.get(`${round}:${team.id}`);
                  const isNext =
                    !pick && team.id === onClockTeamId && round === nextRound;

                  return (
                    <td
                      key={team.id}
                      className={`border border-zinc-200 p-0.5 align-top dark:border-zinc-800 ${
                        isNext ? "bg-amber-100 dark:bg-amber-950/50" : ""
                      }`}
                    >
                      {pick ? (
                        <div
                          className={`sticker flex flex-col gap-0.5 border px-1.5 py-1 ${positionColor(
                            pick.position
                          )} ${
                            latest && pick.id === latest.id
                              ? "ring-2 ring-black dark:ring-white"
                              : ""
                          }`}
                          // A permanent tilt seeded from the pick id, so
                          // it is the same slight crookedness on every
                          // reload. Not the commissioner's stored
                          // placement - that is where on the board he
                          // pressed it, which this grid has no room to
                          // honour anyway.
                          style={stickerStyle(pick.id)}
                        >
                          <span className="truncate text-[11px] font-bold leading-tight">
                            {pick.playerName}
                          </span>
                          <span className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide opacity-70">
                            <span>
                              {pick.position ?? "—"}
                              {pick.nflTeam ? ` · ${pick.nflTeam}` : ""}
                            </span>
                            <span className="font-mono tabular-nums">
                              {pick.pickNumber}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="h-[34px]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-center text-xs text-zinc-500">
        {onClockTeamId
          ? onClockTeamId === myTeamId
            ? "You're on the clock — take your pick from My team."
            : `On the clock: ${
                splitTeamName(
                  teams.find((t) => t.id === onClockTeamId)?.name ?? ""
                ).teamName
              }`
          : "That's the whole board."}
      </p>
    </>
  );
}
