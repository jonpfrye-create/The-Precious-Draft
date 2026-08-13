"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { draftablePositions, forcedPositions } from "@/lib/draft/roster-fit";
import {
  placementFromClick,
  placementStyle,
  stickerStyle,
} from "@/lib/stickers";
import { makePick, undoLastPick } from "./actions";

interface DraftBoardProps {
  league: League;
  leagueCode: string;
  isDemo: boolean;
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
  isDemo,
  phase,
  teams,
  rosterSlots,
  picks,
  pickedPlayers,
  availablePlayers,
}: DraftBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  // The player currently peeling off the sheet, and the pick pressing onto
  // the board. Both are purely visual and clear themselves.
  const [peelingPlayerId, setPeelingPlayerId] = useState<string | null>(null);
  const [pressedPickId, setPressedPickId] = useState<string | null>(null);
  // The sticker currently peeled off and waiting to be pressed onto the
  // board. Holding one is what replaces the old confirmation dialog: the
  // pick isn't made until it's physically placed somewhere.
  const [heldPlayer, setHeldPlayer] = useState<Player | null>(null);
  const onClockCellRef = useRef<HTMLTableCellElement | null>(null);

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

  // The sticker that just went on. Only this one animates; the rest keep
  // their permanent tilt.
  const latestPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const newestPickId =
    latestPick && latestPick.id === pressedPickId ? latestPick.id : null;

  // What the team on the clock has already drafted, and therefore which
  // positions still have a slot to go in. Recomputed here so the room finds
  // out before a name is called out - the server enforces the same rule,
  // but discovering it as a rejected pick is a worse experience.
  const slotSpecs = useMemo(
    () =>
      rosterSlots.map((slot) => ({
        slotName: slot.slot_name,
        eligiblePositions: slot.eligible_positions,
      })),
    [rosterSlots]
  );

  const onClockDraftedPositions = useMemo(() => {
    if (!onClockTeam) return [];
    return picks
      .filter((p) => p.team_id === onClockTeam.id)
      .map((p) => playerById.get(p.player_id)?.position ?? null);
  }, [picks, onClockTeam, playerById]);

  const allowedPositions = useMemo(
    () =>
      new Set(
        draftablePositions(onClockDraftedPositions, slotSpecs, POSITIONS)
      ),
    [onClockDraftedPositions, slotSpecs]
  );

  const forced = useMemo(
    () => forcedPositions(onClockDraftedPositions, slotSpecs, POSITIONS),
    [onClockDraftedPositions, slotSpecs]
  );

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availablePlayers.filter((p) => {
      if (positionFilter !== "ALL" && p.position !== positionFilter) return false;
      if (term && !p.full_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [availablePlayers, search, positionFilter]);

  const toggleHeld = useCallback(
    (player: Player) => {
      setError(null);
      setHeldPlayer((current) =>
        current?.player_id === player.player_id ? null : player
      );
    },
    []
  );

  // Bring the target cell into view the moment a sticker is picked up, so
  // the commissioner isn't hunting for their slot on a 14-round board.
  useEffect(() => {
    if (!heldPlayer) return;
    onClockCellRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, [heldPlayer]);

  // Escape puts the sticker back on the sheet.
  useEffect(() => {
    if (!heldPlayer) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setHeldPlayer(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [heldPlayer]);

  function placeHeldSticker(event: React.MouseEvent<HTMLTableCellElement>) {
    const player = heldPlayer;
    if (!player || !onClockTeam) return;

    // Where in the cell it was pressed decides where the sticker sits.
    // This click is the confirmation - there's no dialog, because putting
    // a sticker somewhere specific is already a deliberate act.
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = placementFromClick(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height
    );

    setError(null);
    setHeldPlayer(null);
    setPeelingPlayerId(player.player_id);
    startTransition(async () => {
      try {
        const result = await makePick(phase.id, player.player_id, placement);
        setSearch("");
        if (result?.pickId) setPressedPickId(result.pickId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to make pick");
      } finally {
        setTimeout(() => setPeelingPlayerId(null), 500);
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
            </Link>{" "}
            <Link
              href="/commish/rosters"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Rosters for Yahoo
            </Link>
            {isDemo && (
              <>
                {" "}
                <Link
                  href="/commish/demo"
                  className="font-medium text-amber-700 hover:underline dark:text-amber-500"
                >
                  Demo controls
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {phase.status === "completed" ? (
            <div className="flex items-center gap-3">
              <span className="rounded bg-green-600 px-4 py-2 font-medium text-white">
                {phase.type} draft complete
              </span>
              {phase.type !== "microwave" && (
                <Link
                  href="/commish/next-phase"
                  className="rounded bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
                >
                  Start {phase.type === "main" ? "Leftovers" : "Microwave"} →
                </Link>
              )}
            </div>
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

      {phase.order_drawn_at === null && (
        <div className="rounded border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="font-medium">
            The draft order hasn&apos;t been drawn yet.
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Teams below are in the placeholder order from setup. Draw the real
            order before the first pick — once anyone drafts, it&apos;s locked.{" "}
            <Link
              href="/commish/order"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Draw the draft order →
            </Link>
          </p>
        </div>
      )}

      {phase.order_drawn_at !== null &&
        phase.order_revealed_count < teams.length && (
          <div className="rounded border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="font-medium">Draft order reveal is in progress.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {phase.order_revealed_count} of {teams.length} picks revealed.
              The columns below already show the full order — don&apos;t put
              this on the TV until the reveal is finished.{" "}
              <Link
                href="/commish/order"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Back to the reveal →
              </Link>
            </p>
          </div>
        )}

      {phase.order_draw_count > 1 && (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Draft order was redrawn {phase.order_draw_count - 1}{" "}
          {phase.order_draw_count - 1 === 1 ? "time" : "times"}.
        </p>
      )}

      {forced.length > 0 && onClockTeam && phase.status !== "completed" && (
        <div className="rounded border border-blue-400 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/40">
          <p className="font-medium">
            {onClockTeam.name} must draft{" "}
            {forced.length === 1 ? "a" : "one of"}{" "}
            <span className="font-bold">{forced.join(" / ")}</span>
            {forced.length === 1 ? " now" : ""}.
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            It&apos;s the only roster slot they have left to fill. Everything
            else is greyed out below.
          </p>
        </div>
      )}

      {heldPlayer && onClockTeam && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center gap-3 rounded-lg border-2 border-amber-500 bg-amber-100 p-4 shadow-lg dark:bg-amber-950/80">
          <span
            className={`sticker border-2 px-3 py-1 ${positionColor(heldPlayer.position)}`}
          >
            <span className="font-bold">{heldPlayer.full_name}</span>
          </span>
          <span className="font-medium">
            Now click {onClockTeam.name}&apos;s square to stick it on — where
            you click is where it lands.
          </span>
          <button
            type="button"
            onClick={() => setHeldPlayer(null)}
            className="ml-auto rounded border border-zinc-400 px-3 py-1 text-sm dark:border-zinc-600"
          >
            Put it back (Esc)
          </button>
        </div>
      )}

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
                  // The one cell that can receive the held sticker.
                  const isTarget = Boolean(isOnClock && heldPlayer);
                  return (
                    <td
                      key={team.id}
                      ref={isOnClock ? onClockCellRef : undefined}
                      onClick={
                        isTarget ? (e) => placeHeldSticker(e) : undefined
                      }
                      className={`border-l border-t border-zinc-200 p-1 align-top dark:border-zinc-800 ${
                        isTarget
                          ? "cursor-crosshair bg-amber-100 ring-4 ring-amber-400 dark:bg-amber-950/50"
                          : ""
                      }`}
                    >
                      {player && pick ? (
                        <div
                          // Only the most recent pick animates. Replaying
                          // the press on every sticker whenever the board
                          // refreshed would be chaos on a TV.
                          className={`sticker border px-2 py-1 ${positionColor(player.position)} ${
                            pick.id === newestPickId ? "sticker-press" : ""
                          }`}
                          style={
                            pick.id === newestPickId
                              ? undefined
                              : placementStyle(pick.id, pick)
                          }
                        >
                          <div className="font-medium leading-tight">
                            {player.full_name}
                          </div>
                          <div className="text-xs opacity-70">
                            {player.position}
                            {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                          </div>
                        </div>
                      ) : isTarget ? (
                        <div className="rounded border-2 border-dashed border-amber-600 px-2 py-3 text-center text-xs font-bold uppercase text-amber-800 dark:border-amber-400 dark:text-amber-300">
                          Click to stick it here
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

          {/* The sticker sheet: available players laid out as a printed
              sheet, the way the physical one was. Clicking a sticker peels
              it off and holds it; the board is where it gets pressed on. */}
          <div className="max-h-[440px] overflow-y-auto rounded-lg border border-zinc-300 bg-zinc-200/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredPlayers.slice(0, 200).map((player) => {
                // Greyed out rather than hidden: the room should be able to
                // see that the player is there and why they can't be taken.
                const fits = allowedPositions.has(player.position ?? "");
                const peeling = peelingPlayerId === player.player_id;
                const held = heldPlayer?.player_id === player.player_id;
                return (
                  <button
                    key={player.player_id}
                    type="button"
                    disabled={isPending || !onClockTeam || !fits}
                    onClick={() => toggleHeld(player)}
                    title={
                      fits
                        ? "Peel this sticker off, then click the board"
                        : `${onClockTeam?.name ?? "This team"} has no roster slot left for a ${player.position ?? "?"}`
                    }
                    style={held ? undefined : stickerStyle(player.player_id)}
                    className={`sticker sticker-sheet-row flex flex-col items-start gap-1 border-2 px-2 py-2 text-left disabled:cursor-not-allowed ${positionColor(player.position)} ${
                      fits ? "" : "opacity-40"
                    } ${peeling ? "sticker-peel" : ""} ${
                      held
                        ? "ring-4 ring-amber-500 ring-offset-2 dark:ring-offset-black"
                        : ""
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                      {player.position ?? "?"}
                      {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                    </span>
                    <span className="text-sm font-bold leading-tight">
                      {player.full_name}
                    </span>
                    {!fits && onClockTeam && (
                      <span className="text-[10px] italic opacity-70">
                        no slot left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {filteredPlayers.length === 0 && (
              <p className="p-3 text-zinc-500">No players match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
