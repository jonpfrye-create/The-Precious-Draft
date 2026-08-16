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
  SheetPlayer,
  Team,
} from "@/lib/draft/queries";
import { generateSnakeOrder, currentPick } from "@/lib/draft/snake-order";
import { positionColor, POSITIONS } from "@/lib/positions";
import { draftablePositions, forcedPositions } from "@/lib/draft/roster-fit";
import { placementFromClick, placementStyle } from "@/lib/stickers";
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
  sheetPlayers: SheetPlayer[];
  allPhases: PhaseLink[];
}

export interface PhaseLink {
  id: string;
  type: string;
  status: string;
  /** The phase the draft is actually on right now. */
  isLive: boolean;
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
  sheetPlayers,
  allPhases,
}: DraftBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>(POSITIONS[0]);
  // The player currently peeling off the sheet, and the pick pressing onto
  // the board. Both are purely visual and clear themselves.
  const [peelingPlayerId, setPeelingPlayerId] = useState<string | null>(null);
  const [pressedPickId, setPressedPickId] = useState<string | null>(null);
  // The sticker currently peeled off and waiting to be pressed onto the
  // board. Holding one is what replaces the old confirmation dialog: the
  // pick isn't made until it's physically placed somewhere.
  const [heldPlayer, setHeldPlayer] = useState<SheetPlayer | null>(null);
  const onClockCellRef = useRef<HTMLTableCellElement | null>(null);
  const boardStageRef = useRef<HTMLDivElement | null>(null);
  // Where the held sticker follows the cursor, and where to zoom the board
  // from. Both only exist while something is in hand.
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(
    null
  );

  // Whether this is the board the draft is actually on. Looking back at a
  // finished phase must stay read-only: undo there would reopen a
  // completed draft that a later phase has already excluded players from.
  const viewingLive = allPhases.find((p) => p.id === phase.id)?.isLive ?? true;
  const livePhase = allPhases.find((p) => p.isLive);

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

  const searchTerm = search.trim().toLowerCase();
  const filteredPlayers = useMemo(() => {
    return sheetPlayers.filter((p) => {
      // Searching looks across every sheet - otherwise finding one player
      // means already knowing which position tab they're filed under. It
      // also skips the gaps, since searching for someone already drafted
      // and getting a blank tile would just be confusing.
      if (searchTerm) {
        return !p.taken && p.full_name.toLowerCase().includes(searchTerm);
      }
      return p.position === positionFilter;
    });
  }, [sheetPlayers, searchTerm, positionFilter]);

  const clearHeld = useCallback(() => {
    setHeldPlayer(null);
    setCursor(null);
    setZoomOrigin(null);
  }, []);

  const toggleHeld = useCallback(
    (player: SheetPlayer) => {
      setError(null);
      if (heldPlayer?.player_id === player.player_id) {
        clearHeld();
        return;
      }
      // Zoom the board toward the slot being drafted into. Scrolling it
      // into view barely registered on a TV; actually scaling toward the
      // cell reads as the board coming to meet you.
      //
      // The origin is the target cell's centre in the stage's own
      // coordinates, so the zoom pushes in on that exact square rather
      // than the middle of the table. Measured here, at the click, rather
      // than in an effect.
      const cell = onClockCellRef.current;
      const stage = boardStageRef.current;
      if (cell && stage) {
        const cellRect = cell.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        setZoomOrigin({
          x: cellRect.left - stageRect.left + cellRect.width / 2,
          y: cellRect.top - stageRect.top + cellRect.height / 2,
        });
      }
      setHeldPlayer(player);
    },
    [heldPlayer, clearHeld]
  );

  // The held sticker rides with the cursor, so it reads as being carried
  // from the sheet to the board.
  useEffect(() => {
    if (!heldPlayer) return;
    function onMove(event: MouseEvent) {
      setCursor({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [heldPlayer]);

  // Escape puts the sticker back on the sheet.
  useEffect(() => {
    if (!heldPlayer) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") clearHeld();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [heldPlayer, clearHeld]);

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
    clearHeld();
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
            </Link>{" "}
            <Link
              href="/commish/grades"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Grades
            </Link>{" "}
            <Link
              href="/commish/claims"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Claims
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
          {allPhases.length > 1 && (
            <div className="flex items-center gap-1 rounded border border-zinc-300 p-1 dark:border-zinc-700">
              {allPhases.map((p) => (
                <Link
                  key={p.id}
                  href={`/commish/board?phase=${p.id}`}
                  className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                    p.id === phase.id
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {p.type}
                  {p.isLive && p.id !== phase.id && (
                    <span
                      className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500 align-middle"
                      title="the draft is here right now"
                    />
                  )}
                </Link>
              ))}
            </div>
          )}
          {phase.status === "completed" ? (
            <div className="flex items-center gap-3">
              <span className="rounded bg-green-600 px-4 py-2 font-medium text-white">
                {phase.type} draft complete
              </span>
              <Link
                href="/commish/rosters"
                className="rounded border-2 border-black px-4 py-2 font-medium dark:border-white"
              >
                Rosters for Yahoo →
              </Link>
              {phase.type !== "microwave" && viewingLive && (
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
            disabled={isPending || picks.length === 0 || !viewingLive}
            title={
              viewingLive
                ? undefined
                : "Undo only works on the board the draft is on"
            }
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

      {!viewingLive && livePhase && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          <span className="text-sm text-amber-900 dark:text-amber-200">
            You&apos;re looking back at the finished{" "}
            <span className="font-semibold capitalize">{phase.type}</span>{" "}
            board. Nothing here can be changed.
          </span>
          <Link
            href={`/commish/board?phase=${livePhase.id}`}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Back to <span className="capitalize">{livePhase.type}</span> &rarr;
          </Link>
        </div>
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

      {heldPlayer && cursor && (
        // Carried under the cursor rather than parked in a bar at the top:
        // the sticker is in your hand until you press it down. Pointer
        // events off so it never eats the click meant for the board.
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <div
            className={`sticker border-2 px-3 py-2 shadow-2xl ${positionColor(heldPlayer.position)}`}
            // Straight while it's in your hand. The tilt is a consequence
            // of being pressed onto the board, not of existing.
            style={{ transform: "scale(1.15)" }}
          >
            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">
              {heldPlayer.position}
              {heldPlayer.nfl_team ? ` · ${heldPlayer.nfl_team}` : ""}
            </div>
            <div className="text-base font-bold leading-tight">
              {heldPlayer.full_name}
            </div>
          </div>
        </div>
      )}

      {heldPlayer && onClockTeam && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
          Click {onClockTeam.name}&apos;s square to stick it on — where you
          click is where it lands. Esc puts it back.
        </p>
      )}

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <div
        ref={boardStageRef}
        className={`rounded border border-zinc-200 dark:border-zinc-800 ${
          heldPlayer ? "overflow-hidden" : "overflow-x-auto"
        }`}
      >
        <div
          className="origin-center transition-transform duration-500 ease-out"
          style={
            heldPlayer && zoomOrigin
              ? {
                  transform: "scale(1.75)",
                  transformOrigin: `${zoomOrigin.x}px ${zoomOrigin.y}px`,
                }
              : undefined
          }
        >
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
                        isTarget ? "cursor-crosshair" : ""
                      }`}
                    >
                      {player && pick ? (
                        // The permanent placement sits on the wrapper, so
                        // the sticker is already at its final angle the
                        // instant it appears. The press animation runs
                        // inside and only scales and fades - if it drove
                        // the transform itself it would end at "straight"
                        // and the tilt would snap in later.
                        <div style={placementStyle(pick.id, pick)}>
                          <div
                            // Only the most recent pick animates. Replaying
                            // the press on every sticker whenever the board
                            // refreshed would be chaos on a TV.
                            className={`sticker border px-2 py-1 ${positionColor(player.position)} ${
                              pick.id === newestPickId ? "sticker-press" : ""
                            }`}
                          >
                            <div
                              className={`leading-tight ${
                                player.adp_formatted
                                  ? "font-medium"
                                  : "sharpie text-[15px]"
                              }`}
                            >
                              {player.full_name}
                            </div>
                            <div
                              className={`text-xs opacity-70 ${
                                player.adp_formatted ? "" : "sharpie"
                              }`}
                            >
                              {player.position}
                              {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                            </div>
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
              {POSITIONS.map((pos) => (
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
                // A gap where a sticker used to be. Kept in place rather
                // than closed up, so the sheet empties out as the draft
                // goes on and you scroll further to find anyone left -
                // which is exactly what happened to the paper sheets.
                if (player.taken) {
                  return (
                    <span
                      key={player.player_id}
                      aria-hidden
                      className="rounded border-2 border-dashed border-zinc-300 bg-zinc-100/40 dark:border-zinc-800 dark:bg-zinc-950/40"
                    />
                  );
                }

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
                    className={`sticker sticker-sheet-row flex flex-col items-start gap-1 border-2 px-2 py-2 text-left disabled:cursor-not-allowed ${positionColor(player.position)} ${
                      fits ? "" : "opacity-40"
                    } ${peeling ? "sticker-peel" : ""} ${
                      held
                        ? "ring-4 ring-amber-500 ring-offset-2 dark:ring-offset-black"
                        : ""
                    }`}
                  >
                    <span className="flex w-full items-baseline justify-between gap-2 text-[10px] font-black uppercase tracking-wider opacity-70">
                      <span>
                        {player.position ?? "?"}
                        {player.nfl_team ? ` · ${player.nfl_team}` : ""}
                      </span>
                      {/* Where the rest of the world is taking this player.
                          Blank rather than zero when the feed doesn't cover
                          them, which is most of the pool. */}
                      {player.adp_formatted && (
                        <span className="tabular-nums">
                          ADP {player.adp_formatted}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-sm leading-tight ${
                        player.adp_formatted
                          ? "font-bold"
                          : "sharpie text-[15px]"
                      }`}
                    >
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
