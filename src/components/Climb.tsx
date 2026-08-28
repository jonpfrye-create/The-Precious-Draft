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
import { shortLabel } from "@/lib/climb/font";
import { assignMascots, eyeClusters } from "@/lib/climb/mascots";
import type { PaintTeam } from "@/lib/climb/paint";
import {
  CARD_H,
  CARD_W,
  paintCardScene,
  paintClimb,
  rgb,
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

/**
 * How long the pack takes to climb between two fellings.
 *
 * Long enough to actually watch them walk. At 2.2s the first press went
 * more or less straight to a death, which threw away the only part of
 * this that is a climb.
 */
const WALK_MS = 4000;

/** The lightning, and the beat of skull afterwards. */
const STRIKE_MS = 1400;

/** How long the announcement card holds. */
const CARD_MS = 4200;

/** Leg frames per second, roughly. */
const TICK_MS = 190;

/**
 * The canvas is drawn at this many pixels tall whatever its size on
 * screen, and scaled up.
 *
 * Fewer pixels means bigger ones. At 200 the mascots were technically on
 * screen and practically unreadable across a room - everything here is
 * meant to be seen from a sofa, so the whole scene gets about half as
 * many pixels and each one is twice the size.
 */
const VIEW_H = 128;

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

/**
 * Two hard strokes and a fade, rather than one smooth ramp - lightning
 * does not dim politely, and the second stroke is what makes a person
 * look up.
 */
function flashAt(t: number): number {
  if (t < 0.1) return 0.95;
  if (t < 0.18) return 0.12;
  if (t < 0.27) return 0.8;
  if (t < 0.6) return 0.3 * (1 - (t - 0.27) / 0.33);
  return 0;
}

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
  // The mascot currently being struck, and how white the frame is.
  const [strike, setStrike] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  // Bumped when a card finishes, purely to wake the sequencer for the
  // next felling when several arrived while one was being played out.
  const [beat, setBeat] = useState(0);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 320, h: VIEW_H });

  // Held phones are portrait, and this is a landscape picture. Rather
  // than shrink the mountain to fit a tall thin box, ask for the phone
  // to be turned - it is one gesture and it roughly doubles the size of
  // everything on screen.
  const [portrait, setPortrait] = useState(false);
  const [ignoredTurn, setIgnoredTurn] = useState(false);

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
          {
            mascot: mascots.get(t.teamId)!,
            jersey: t.hex,
            label: shortLabel(splitTeamName(t.name).teamName),
          },
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
    const hold = (latest: Climber) => {
      setCard(latest);
      timer.current = setTimeout(() => {
        setCard(null);
        setStrike(null);
        running.current = false;
        // Wakes this effect again, in case more than one slot was turned
        // over while this one was being played out.
        setBeat((b) => b + 1);
      }, CARD_MS);
    };

    const arrive = () => {
      setWalkAltitude(null);
      setShown(next);

      const latest = climbScene(teams, fellingsUpTo(fellings, next), seed).latest;
      if (!latest) {
        running.current = false;
        return;
      }

      // Nothing happens to the one that reaches the top, so there is no
      // lightning and no skull - just the summit and the fanfare.
      if (latest.position === 1) {
        playFanfare();
        hold(latest);
        return;
      }

      // The strike itself: lightning over the whole frame, a skull on
      // the mascot, and the bang at the moment of the flash rather than
      // when the card turns up a beat and a half later.
      setStrike(latest.teamId);
      playStinger(Math.min(1, next / Math.max(1, fieldSize)));

      const struckAt = performance.now();
      const strikeStep = (now: number) => {
        const t = Math.min(1, (now - struckAt) / STRIKE_MS);
        setFlash(flashAt(t));
        if (t >= 1) {
          setFlash(0);
          hold(latest);
          return;
        }
        raf.current = requestAnimationFrame(strikeStep);
      };
      raf.current = requestAnimationFrame(strikeStep);
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
    // Width as well as orientation: a tablet in portrait has plenty of
    // room and does not need telling, and a desktop window that happens
    // to be tall is not a phone.
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
      setSize({ w: Math.min(300, Math.max(120, w)), h: VIEW_H });
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
      flash,
      strikeTeamId: strike,
    });
    ctx.putImageData(image.current, 0, 0);
  }, [scene, paintTeams, seed, tick, packAltitude, myTeamId, size, flash, strike]);

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

        {portrait && !ignoredTurn ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#0b1020]/94 px-6 text-center">
            <div
              aria-hidden
              className="h-9 w-14 animate-opa-blink border-4 border-[#e8a33d]"
            />
            <p className="font-arcade text-[10px] leading-relaxed text-[#e8a33d] sm:text-[12px]">
              TURN YOUR PHONE SIDEWAYS
            </p>
            <p className="font-plex max-w-[16rem] text-xs text-zinc-400">
              The mountain is about twice the size in landscape. You
              won&apos;t miss anything — nothing happens until the
              commissioner presses.
            </p>
            <button
              type="button"
              onClick={() => setIgnoredTurn(true)}
              className="font-plex text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
            >
              Watch it this way
            </button>
          </div>
        ) : null}

        {card && cardTeam ? (
          <>
            {summit ? <Confetti accent={teams.find((t) => t.teamId === card.teamId)?.hex ?? "#e8a33d"} /> : null}
            <div className="absolute inset-0 flex items-center justify-center bg-[#0b1020]/72 px-4">
              <div className="flex max-w-sm flex-col items-center gap-3 border-4 border-[#efe6d2] bg-[#14100d] px-5 py-5 shadow-[8px_8px_0_#c1391f]">
                <CardScene
                  teamId={card.teamId}
                  intact={summit}
                  hazardId={card.hazard?.id ?? null}
                  tick={tick}
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

/** The card scene: the mascot it happened to, beside the thing that did it. */
function CardScene({
  teamId,
  intact,
  hazardId,
  tick,
  paintTeams,
}: {
  teamId: string;
  intact: boolean;
  hazardId: string | null;
  tick: number;
  paintTeams: Map<string, PaintTeam>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    const team = paintTeams.get(teamId);
    if (!el || !ctx || !team) return;

    const image = ctx.createImageData(CARD_W, CARD_H);
    const painter = imagePainter(image);
    // The card's own background, painted rather than left transparent -
    // createImageData starts fully transparent black, which shows as a
    // hole rather than as the card behind it.
    const bg = rgb("#14100d");
    for (let y = 0; y < CARD_H; y++)
      for (let x = 0; x < CARD_W; x++) painter.px(x, y, bg);

    paintCardScene(
      painter,
      team.mascot,
      team.jersey,
      // The one mascot on the mountain that nothing happened to keeps
      // its eyes.
      intact ? [] : eyeClusters(team.mascot),
      intact ? null : hazardId,
      tick
    );
    ctx.putImageData(image, 0, 0);
  }, [teamId, intact, hazardId, tick, paintTeams]);

  return (
    <canvas
      ref={ref}
      width={CARD_W}
      height={CARD_H}
      aria-hidden
      className="h-auto w-full max-w-[290px]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
