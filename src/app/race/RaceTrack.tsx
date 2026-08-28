"use client";

import { useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import { playFanfare, playStinger } from "@/lib/audio/fanfare";
import {
  buildLanes,
  raceAt,
  raceLength,
  type Runner,
} from "@/lib/race/choreography";
import { splitTeamName } from "@/lib/teams/branding";

export interface Racer {
  teamId: string;
  name: string;
  hex: string;
  /** Degrees of hue rotation that turn the mascot's kit this team's colour. */
  hue: number;
}

/** How long the winner takes to cross, in milliseconds. */
const RACE_MS = 16000;

/**
 * The mascot race.
 *
 * Twelve copies of the league mascot in twelve liveries, which is the
 * same joke the sausages and the presidents are making: one silhouette,
 * one costume department, and the comedy is entirely in who wins. It
 * also means one sprite rather than twelve pieces of pixel art.
 *
 * The finish order is settled before the gun. This renders a race that
 * arrives at it - see choreography.ts for why that is the point rather
 * than a shortcut.
 */
export default function RaceTrack({
  racers,
  seed,
}: {
  racers: Racer[];
  seed: string;
}) {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const frame = useRef(0);

  const lanes = buildLanes(
    racers.map((r) => r.teamId),
    seed
  );
  const byId = new Map(racers.map((r) => [r.teamId, r]));
  const total = raceLength(lanes);

  useEffect(() => {
    if (!running) return;

    const startedAt = performance.now();
    // The gun. Everything after this is the same on every screen.
    playStinger(0.2);

    const step = (now: number) => {
      const t = ((now - startedAt) / RACE_MS) * total;
      setRunners(raceAt(lanes, Math.min(t, total)));

      if (t >= total) {
        setRunning(false);
        setDone(true);
        playFanfare();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
    // lanes is derived from props that do not change while a race runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const live = runners.length ? runners : raceAt(lanes, 0);

  // Lanes are fixed and alphabetical, like lanes on a track.
  //
  // They used to render in finish order, which meant the board printed
  // its own answer down the left-hand side before the gun - read the top
  // row and you knew who picked first. What moves is the mascot and the
  // number beside it, never the row.
  const shown = [...live].sort((a, b) =>
    (byId.get(a.teamId)?.name ?? "").localeCompare(byId.get(b.teamId)?.name ?? "")
  );
  const winner = byId.get(lanes[0]?.teamId);

  return (
    <div className="flex w-full flex-col gap-6">
      {done && winner ? <Confetti accent={winner.hex} /> : null}

      <div className="relative overflow-hidden border-2 border-[#2a1f18] bg-[#14100d]">
        {/* The tape. Sits where distance = 1. */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 z-10 w-[10px] opacity-70"
          style={{
            background:
              "repeating-linear-gradient(180deg,#efe6d2 0 8px,#2a1f18 8px 16px)",
          }}
        />

        <ol className="flex flex-col">
          {shown
            .map((runner) => ({ runner, racer: byId.get(runner.teamId)! }))
            .map(({ runner, racer }) => (
              <li
                key={runner.teamId}
                className="relative flex h-[46px] items-center border-b border-[#221a15] last:border-b-0"
                style={{
                  background:
                    runner.place === 0
                      ? "rgba(232,163,61,0.07)"
                      : "transparent",
                }}
              >
                <span className="font-arcade z-10 w-8 shrink-0 pl-2 text-[10px] text-[#6b5340] tabular-nums">
                  {runner.place + 1}
                </span>

                {/* Names sit before the track, not over it. Right-aligned
                    against the finish they were crossing, which put the
                    tape straight through the middle of every one. */}
                <span
                  className="font-plex z-10 w-[30%] shrink-0 truncate pr-3 text-[11px] sm:text-[12px]"
                  style={{ color: racer.hex }}
                >
                  {splitTeamName(racer.name).teamName}
                </span>

                {/* The track: gate to tape, less the sprite's own width
                    so it lands on the line rather than through it. */}
                <div className="relative h-full flex-1">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-none"
                    style={{
                      left: `calc(${runner.distance * 100}% - ${
                        runner.distance * 26
                      }px)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/mascot-8bit.png"
                      alt=""
                      aria-hidden
                      width={610}
                      height={1640}
                      className="h-[38px] w-auto"
                      style={{
                        imageRendering: "pixelated",
                        // One sprite, twelve kits. The uniform is white
                        // and stays white; only the jersey carries enough
                        // saturation for the rotation to bite.
                        filter: `hue-rotate(${racer.hue}deg) saturate(1.15)`,
                        transform: running ? undefined : "none",
                      }}
                    />
                  </div>
                </div>

              </li>
            ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          disabled={running}
          onClick={() => {
            setDone(false);
            setRunners([]);
            setRunning(true);
          }}
          className="font-arcade border-4 border-[#efe6d2] bg-[#e8a33d] px-6 py-4 text-[12px] text-[#14100d] shadow-[7px_7px_0_#c1391f] transition-[transform,box-shadow] hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_#c1391f] disabled:opacity-40 sm:text-[15px]"
        >
          {running ? "RACING..." : done ? "RUN IT AGAIN" : "START THE RACE"}
        </button>
      </div>

      {done && winner ? (
        <p className="font-arcade animate-opa-blink text-center text-[11px] text-[#e8a33d] sm:text-[14px]">
          {splitTeamName(winner.name).teamName} PICKS FIRST
        </p>
      ) : null}
    </div>
  );
}
