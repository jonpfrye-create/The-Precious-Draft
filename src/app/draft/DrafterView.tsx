"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { positionColor, POSITIONS } from "@/lib/positions";
import { draftablePositions, type SlotSpec } from "@/lib/draft/roster-fit";
import { splitTeamName } from "@/lib/teams/branding";
import { ACTION_FAILED } from "@/lib/errors";
import type { SheetPlayer } from "@/lib/draft/queries";
import { makePick } from "@/app/commish/(protected)/board/actions";
import { searchDeepPool } from "./actions";
import { usePhaseChannel } from "@/lib/realtime/usePhaseChannel";
import { generateSnakeOrder, currentPick } from "@/lib/draft/snake-order";

/**
 * The phone half of a pick.
 *
 * The ritual is split: here you peel the sticker off the sheet and watch
 * it fly away, and a moment later it lands on the board on the television
 * with everyone in the room watching. Keeping the press on the big screen
 * is what stops the draft becoming twelve people looking down at their
 * hands.
 *
 * Two taps to draft, not one. A phone in a noisy room is a fat-fingered
 * instrument, and the difference between the right player and the one a
 * row below is a whole season.
 */

/**
 * The phone's list gets an "all" tab, which the board deliberately does
 * not: the board is meant to read like a sheet of stickers organised by
 * position, whereas this is a list you scroll with a thumb, and opening
 * it filtered to quarterbacks helps nobody.
 */
const ALL = "All";

export interface RosterLine {
  slotName: string;
  playerName: string | null;
  nflTeam: string | null;
  position: string | null;
}

export default function DrafterView({
  teamName,
  leagueName,
  phaseType,
  phaseId,
  inPhase,
  totalPicks,
  picksMade,
  teamIds,
  myTeamId,
  teamNames,
  roster,
  slots,
  draftedPositions,
  sheetPlayers,
}: {
  teamName: string;
  leagueName: string;
  phaseType: string;
  phaseId: string;
  inPhase: boolean;
  totalPicks: number;
  picksMade: number;
  /** Team ids in draft-position order, for recomputing the clock here. */
  teamIds: string[];
  myTeamId: string;
  teamNames: Record<string, string>;
  roster: RosterLine[];
  slots: SlotSpec[];
  draftedPositions: string[];
  sheetPlayers: SheetPlayer[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>(ALL);
  const [selected, setSelected] = useState<SheetPlayer | null>(null);
  const [peeling, setPeeling] = useState<string | null>(null);
  // The row vanishing is the confirmation. An explicit "drafted!" note
  // read as an apology for the delay that used to be here.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [deep, setDeep] = useState<SheetPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  // The clock comes from the server's pick count, never from a tally kept
  // here. The first version incremented on every realtime event, which
  // meant an undo - a delete - advanced the draft on every phone instead
  // of reversing it, while the boards showed the truth. A counter that can
  // disagree with the database is worse than one extra fetch.
  const order = useMemo(
    () => generateSnakeOrder(teamIds, Math.ceil(totalPicks / teamIds.length)),
    [teamIds, totalPicks]
  );
  const onClock = currentPick(order, picksMade);
  const isMyTurn = onClock?.teamId === myTeamId;
  const currentTeamName = onClock ? teamNames[onClock.teamId] ?? null : null;

  // Anything happening in this phase - a pick, an undo - is refetched
  // rather than guessed at. Only the drafter's own pick is optimistic,
  // and only visually: the row vanishes at once and is put back if the
  // server refuses it.
  usePhaseChannel(phaseId, () => router.refresh());

  const { teamName: shortName, manager } = splitTeamName(teamName);

  // Positions this roster can still legally take. A player who cannot fit
  // is shown greyed rather than hidden, so the reason is visible.
  //
  // POSITIONS is the six real positions with no "all" entry at the front -
  // slicing one off here silently dropped QB, so every quarterback in the
  // draft was greyed out as unrosterable.
  const canTake = useMemo(
    () => new Set(draftablePositions(draftedPositions, slots, POSITIONS)),
    [draftedPositions, slots]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sheetPlayers
      .filter((p) => !p.taken && !gone.has(p.player_id))
      .filter((p) => position === ALL || p.position === position)
      .filter((p) => !query || p.full_name.toLowerCase().includes(query))
      .slice(0, 60);
  }, [sheetPlayers, position, search, gone]);

  function draft(player: SheetPlayer) {
    setError(null);
    setPeeling(player.player_id);
    startTransition(async () => {
      try {
        await makePick(phaseId, player.player_id);
        // Believed immediately. The pick is already in the database, and
        // waiting for the page to come back before admitting it is what
        // made this feel broken.
        setGone((g) => new Set(g).add(player.player_id));
        setSelected(null);
        setPeeling(null);
        router.refresh();
      } catch (e) {
        // Rolled back only on a real failure.
        setGone((g) => {
          const next = new Set(g);
          next.delete(player.player_id);
          return next;
        });
        setPeeling(null);
        setError(e instanceof Error ? e.message : ACTION_FAILED);
      }
    });
  }

  // Anyone the trimmed sheet does not carry. Only asked for once a search
  // is specific enough to be worth a round trip and the local list has
  // little to show.
  function lookDeeper() {
    const q = search.trim();
    if (q.length < 3) return;
    setSearching(true);
    startTransition(async () => {
      try {
        setDeep(await searchDeepPool(phaseId, q));
      } catch {
        setDeep([]);
      } finally {
        setSearching(false);
      }
    });
  }

  if (!inPhase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">{shortName}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          You&apos;re sitting out {phaseType}. Nothing to do here — the board
          will tell you when the next one starts.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-4">
      {/* Who am I, and is it me? Sticky, because it is the only thing
          most people open this page to find out. */}
      <div className="sticky top-0 z-20 -mx-4 mb-3 bg-white/95 px-4 pb-3 pt-4 backdrop-blur dark:bg-black/95">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">
              {shortName}
            </h1>
            <p className="truncate text-[11px] uppercase tracking-widest text-zinc-500">
              {manager ? `${manager} · ` : ""}
              {leagueName} · {phaseType}
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
            {picksMade}/{totalPicks}
          </span>
        </div>

        <div
          className={`mt-3 rounded-lg px-4 py-3 text-center ${
            isMyTurn
              ? "bg-green-600 text-white"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          }`}
        >
          {isMyTurn ? (
            <>
              <p className="text-lg font-bold">You&apos;re up</p>
              {onClock && (
                <p className="text-xs opacity-90">
                  Round {onClock?.round} · pick {onClock?.overallPick} overall
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {currentTeamName
                  ? `${splitTeamName(currentTeamName).teamName} is on the clock`
                  : "Draft complete"}
              </p>
              <p className="text-xs text-zinc-500">
                Updates on its own — no need to refresh.
              </p>
            </>
          )}
        </div>
      </div>

      {/* My roster so far */}
      <section className="mb-4">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Your roster
        </h2>
        <ol className="flex flex-col gap-0.5 text-sm">
          {roster.map((line, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 font-mono text-[10px] uppercase text-zinc-500">
                {line.slotName}
              </span>
              <span
                className={
                  line.playerName ? "truncate" : "text-zinc-300 dark:text-zinc-700"
                }
              >
                {line.playerName ?? "—"}
                {line.nflTeam && (
                  <span className="text-zinc-500"> ({line.nflTeam})</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* The sheet */}
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {[ALL, ...POSITIONS].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPosition(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
              position === p
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a player"
        autoCapitalize="words"
        autoCorrect="off"
        className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />

      <ul className="flex flex-col gap-1.5">
        {visible.map((player) => {
          const fits = !player.position || canTake.has(player.position);
          const isSelected = selected?.player_id === player.player_id;
          return (
            <li key={player.player_id}>
              <button
                type="button"
                disabled={!fits || isPending}
                onClick={() => setSelected(isSelected ? null : player)}
                className={`sticker flex w-full items-center justify-between gap-2 border px-3 py-3 text-left ${positionColor(
                  player.position
                )} ${peeling === player.player_id ? "sticker-peel" : ""} ${
                  isSelected ? "ring-2 ring-black dark:ring-white" : ""
                } ${!fits ? "opacity-35" : ""}`}
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate ${
                      player.adp_formatted
                        ? "font-semibold"
                        : "sharpie text-[15px]"
                    }`}
                  >
                    {player.full_name}
                  </span>
                  <span className="block text-[11px] opacity-70">
                    {player.position}
                    {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                    {player.adp_formatted ? ` · ADP ${player.adp_formatted}` : ""}
                  </span>
                </span>
                {!fits && (
                  <span className="shrink-0 text-[10px] italic opacity-70">
                    no slot
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {deep
          .filter((p) => !gone.has(p.player_id))
          .filter((p) => !visible.some((v) => v.player_id === p.player_id))
          .map((player) => {
            const fits = !player.position || canTake.has(player.position);
            const isSelected = selected?.player_id === player.player_id;
            return (
              <li key={`deep-${player.player_id}`}>
                <button
                  type="button"
                  disabled={!fits || isPending}
                  onClick={() => setSelected(isSelected ? null : player)}
                  className={`sticker flex w-full items-center justify-between gap-2 border px-3 py-3 text-left ${positionColor(
                    player.position
                  )} ${peeling === player.player_id ? "sticker-peel" : ""} ${
                    isSelected ? "ring-2 ring-black dark:ring-white" : ""
                  } ${!fits ? "opacity-35" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="sharpie block truncate text-[15px]">
                      {player.full_name}
                    </span>
                    <span className="block text-[11px] opacity-70">
                      {player.position}
                      {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                    </span>
                  </span>
                  {!fits && (
                    <span className="shrink-0 text-[10px] italic opacity-70">
                      no slot
                    </span>
                  )}
                </button>
              </li>
            );
          })}

        {visible.length === 0 && deep.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-500">
            Nobody left matching that.
          </li>
        )}

        {/* The phone carries the few hundred most draftable players, not
            all four thousand. Anyone further down is one tap away rather
            than absent - which matters most in the last rounds. */}
        {search.trim().length >= 3 && visible.length < 12 && (
          <li className="pt-2">
            <button
              type="button"
              onClick={lookDeeper}
              disabled={searching || isPending}
              className="w-full rounded-lg border border-dashed border-zinc-400 px-4 py-3 text-sm text-zinc-600 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400"
            >
              {searching
                ? "Looking…"
                : `Search the rest of the pool for “${search.trim()}”`}
            </button>
          </li>
        )}
      </ul>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* The commit bar. Sits over everything, thumb-height, and only
          exists once a player is chosen and it is actually your turn. */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-black">
          <div className="mx-auto flex w-full max-w-md items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isMyTurn || isPending}
              onClick={() => draft(selected)}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
            >
              {isPending
                ? "Drafting…"
                : isMyTurn
                  ? `Draft ${selected.full_name}`
                  : "Not your turn yet"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
