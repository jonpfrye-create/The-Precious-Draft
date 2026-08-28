"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import { playFanfare, playStinger } from "@/lib/audio/fanfare";
import {
  altitudeForStep,
  climbScene,
  ordinal,
  type Climber,
  type ClimbTeam,
  type Felling,
} from "@/lib/climb/climb";
import { assignMascots, eyeClusters } from "@/lib/climb/mascots";
import {
  paintBustedFace,
  paintClimb,
  type Painter,
  type RGB,
} from "@/lib/climb/paint";
import { splitTeamName } from "@/lib/teams/branding";

/**
 * The climb up Bijan Gibbs Mountain, on screen.
 *
 * Twelve mascots set off and get picked off one at a time; every one
 * that goes down is a draft position announced, counting backwards from
 * last pick to first. Whoever is left on the summit picks first.
 *
 * This draws the reveal that already exists rather than replacing it.
 * The only input that moves is `fellings`, which is the list of slots
 * the commissioner has turned over - the same realtime push the list
 * view has always run on. Nothing here writes anything.
 */

/** How long the pack takes to climb between two fellings. */
const WALK_MS = 2200;

/** How long the announcement card holds. */
const CARD_MS = 4200;

/** Leg frames per second, roughly. */
const TICK_MS = 190;

/**
 * The canvas is drawn at this many pixels tall whatever its size on
 * screen, and scaled up. Small enough to look eight-bit, big enough for
 * a mascot to have a face.
 */
const VIEW_H = 200;

function imagePainter(image: ImageData): Painter {
  const d = image.data;
  const { width, height } = image;
  return {
    w: width,
    h: height,
    px(x: number, y: number, c: RGB) {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
      const i = (iy * width + ix) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    },
  };
}

/**
 * The first `k` slots to have been turned over.
 *
 * Reveal order is descending draft position - `nextRevealStep()` turns
 * over the last pick first - so that, and not the order the rows came
 * back from the database, is what decides which felling is which.
 */
function fellingsUpTo(fellings: Felling[], k: number): Felling[] {
  return [...fellings].sort((a, b) => b.position - a.position).slice(0, k);
}

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export default function Climb({
  teams,
  fellings,
  seed,
  myTeamId = null,
  fieldSize,
}: {
  teams: ClimbTeam[];
  fellings: Felling[];
  seed: string;
  myTeamId?: string | null;
  fieldSize: number;
}) {
  const revealed = fellings.length;

  // How many fellings have actually been played out on this screen.
  //
  // Seeded from whatever had already happened when this device arrived,
  // so a phone that joins with eight teams already down shows eight
  // bodies on the mountain rather than replaying eight disasters at
  // somebody who has been in the room the whole time.
  const [shown, setShown] = useState(revealed);

  // Non-null only while the pack is walking between two fellings.
  const [walkAltitude, setWalkAltitude] = useState<number | null>(null);
  const [card, setCard] = useState<Climber | null>(null);
  // Bumped when a card finishes, purely to wake the sequencer for the
  // next felling when several arrived while one was being played out.
  const [beat, setBeat] = useState(0);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 320, h: VIEW_H });

  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<ImageData | null>(null);

  const mascots = useMemo(
    () => assignMascots(teams.map((t) => t.teamId), seed),
    [teams, seed]
  );
  const paintTeams = useMemo(
    () =>
      new Map(
        teams.map((t) => [
          t.teamId,
          { mascot: mascots.get(t.teamId)!, jersey: t.hex },
        ])
      ),
    [teams, mascots]
  );
  const nameById = useMemo(
    () => new Map(teams.map((t) => [t.teamId, t.name])),
    [teams]
  );

  const scene = useMemo(
    () => climbScene(teams, fellingsUpTo(fellings, shown), seed),
    [teams, fellings, shown, seed]
  );

  const walking = walkAltitude !== null;
  const packAltitude = walkAltitude ?? scene.packAltitude;

  // ---- one felling, played out start to finish ------------------------

  const running = useRef(false);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      // Only on unmount. Tearing these down whenever the dependencies
      // move would cancel the card's own hold timer the instant the card
      // appeared, because showing the card is itself a state change.
      cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  useEffect(() => {
    if (running.current || revealed <= shown) return;
    running.current = true;

    const from = altitudeForStep(fieldSize, shown);
    const to = altitudeForStep(fieldSize, shown + 1);
    const next = shown + 1;
    const startedAt = performance.now();

    // The pack walks up to the next felling, *then* one of them goes
    // down and the card comes in. Announcing on arrival of the data
    // instead would put the pick number on screen while the mascot it
    // belongs to was still halfway up the mountain.
    const arrive = () => {
      setWalkAltitude(null);
      setShown(next);

      const latest = climbScene(teams, fellingsUpTo(fellings, next), seed).latest;
      if (latest) {
        setCard(latest);
        if (latest.position === 1) playFanfare();
        else playStinger(Math.min(1, next / Math.max(1, fieldSize)));
      }

      timer.current = setTimeout(() => {
        setCard(null);
        running.current = false;
        // Wakes this effect again, in case more than one slot was turned
        // over while this one was being played out.
        setBeat((b) => b + 1);
      }, CARD_MS);
    };

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / WALK_MS);
      setWalkAltitude(from + (to - from) * easeInOut(t));
      if (t >= 1) {
        arrive();
        return;
      }
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
  }, [revealed, shown, beat, fieldSize, teams, fellings, seed]);

  // ---- painting -------------------------------------------------------

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      // Internal height is fixed and the width follows the box, so the
      // mountain fills a wide television and a tall phone equally
      // without either letterboxing it or stretching the pixels.
      const w = Math.round(VIEW_H * (box.width / Math.max(1, box.height)));
      setSize({ w: Math.min(460, Math.max(170, w)), h: VIEW_H });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (
      !image.current ||
      image.current.width !== size.w ||
      image.current.height !== size.h
    ) {
      image.current = ctx.createImageData(size.w, size.h);
    }
    const painter = imagePainter(image.current);
    paintClimb(painter, {
      scene,
      teams: paintTeams,
      seed,
      tick,
      packAltitude,
      highlightTeamId: myTeamId,
    });
    ctx.putImageData(image.current, 0, 0);
  }, [scene, paintTeams, seed, tick, packAltitude, myTeamId, size]);

  // ---- the card -------------------------------------------------------

  const cardTeam = card ? paintTeams.get(card.teamId) : undefined;
  const cardName = card ? nameById.get(card.teamId) ?? "" : "";
  const summit = card?.position === 1;

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        ref={wrap}
        className="relative aspect-[4/3] w-full overflow-hidden border-2 border-[#2a1f18] bg-[#0b1020] sm:aspect-[16/9]"
      >
        <canvas
          ref={canvas}
          width={size.w}
          height={size.h}
          className="h-full w-full"
          style={{ imageRendering: "pixelated" }}
          aria-hidden
        />

        {card && cardTeam ? (
          <>
            {summit ? <Confetti accent={teams.find((t) => t.teamId === card.teamId)?.hex ?? "#e8a33d"} /> : null}
            <div className="absolute inset-0 flex items-center justify-center bg-[#0b1020]/72 px-4">
              <div className="flex max-w-sm flex-col items-center gap-3 border-4 border-[#efe6d2] bg-[#14100d] px-5 py-5 shadow-[8px_8px_0_#c1391f]">
                <BustedFace
                  teamId={card.teamId}
                  jersey={cardTeam.jersey}
                  mascotId={cardTeam.mascot.id}
                  intact={summit}
                  paintTeams={paintTeams}
                />
                <p
                  className="font-arcade text-center text-[15px] text-[#e8a33d] sm:text-[20px]"
                  style={{ lineHeight: 1.5 }}
                >
                  {ordinal(card.position ?? 0)} PICK
                </p>
                <p className="font-plex text-center text-sm font-semibold text-[#efe6d2]">
                  {splitTeamName(cardName).teamName}
                </p>
                <p className="font-arcade text-center text-[8px] leading-relaxed text-[#8a7c68] sm:text-[9px]">
                  {summit
                    ? `${cardTeam.mascot.name} REACHES THE SUMMIT`
                    : card.hazard?.label ?? ""}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <p className="font-plex text-center text-xs text-zinc-500">
        {scene.complete
          ? "That's the order."
          : walking
            ? "Climbing…"
            : `${shown} of ${fieldSize} down. ${fieldSize - shown} still on the mountain.`}
      </p>
    </div>
  );
}

/** The head on the card: big, pixelated, and usually with Xs for eyes. */
function BustedFace({
  teamId,
  jersey,
  mascotId,
  intact,
  paintTeams,
}: {
  teamId: string;
  jersey: string;
  mascotId: string;
  intact: boolean;
  paintTeams: Map<string, { mascot: { id: string; head: string[] }; jersey: string }>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    const team = paintTeams.get(teamId);
    if (!el || !ctx || !team) return;

    const mascot = team.mascot as Parameters<typeof paintBustedFace>[1];
    const w = mascot.head[0]?.length ?? 16;
    const h = mascot.head.length;
    const image = ctx.createImageData(w, h);
    const painter = imagePainter(image);
    // The summiteer is the one mascot on the mountain that nothing
    // happened to, so it keeps its eyes.
    paintBustedFace(painter, mascot, jersey, intact ? [] : eyeClusters(mascot));
    ctx.putImageData(image, 0, 0);
  }, [teamId, jersey, mascotId, intact, paintTeams]);

  const team = paintTeams.get(teamId);
  const w = team?.mascot.head[0]?.length ?? 16;
  const h = team?.mascot.head.length ?? 10;

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      aria-hidden
      className="h-[72px] w-auto sm:h-[92px]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
