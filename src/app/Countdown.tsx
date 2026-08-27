"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { draftClock, DRAFT_START_MS, type DraftClock } from "@/lib/draft/draft-clock";
import {
  BEEP_INTERVAL_MS,
  LEVEL_NAMES,
  chaosLevel,
  tensionAt,
} from "@/lib/draft/tension";
import { playBeep } from "@/lib/audio/fanfare";

/**
 * The band under the poster: a counter that becomes the way in.
 *
 * Two things about this are deliberate.
 *
 * It is handed the *server's* clock and works from that, not from
 * `Date.now()` on the device. Twelve people are going to be staring at
 * this at 4:59 and the door has to open for all of them at once; a phone
 * whose clock is four minutes fast would otherwise be in before anyone
 * else, and one that is slow would be locked out and convinced the site
 * was broken. The skew is measured once at mount and applied to every
 * tick after.
 *
 * It is also handed a first reading taken on the server, and renders
 * that until it mounts. That means no flash of placeholder digits, no
 * hydration mismatch, and - the part that matters - a page that still
 * shows the right thing with JavaScript broken or still loading. It
 * freezes rather than ticking, but anyone arriving after five o'clock
 * gets a working door either way.
 */
export default function Countdown({
  initial,
  serverNow,
  enterHref,
  forceOpen = false,
  tensionOverride = null,
}: {
  initial: DraftClock;
  serverNow: number;
  enterHref: string;
  /**
   * Forces the crescendo to a fixed point on the curve, from `?tension=`.
   * Lets the whole build be looked at now rather than only by waiting
   * until Saturday, which is not a debugging strategy.
   */
  tensionOverride?: number | null;
  /**
   * Opens the door regardless of the clock, from `?open=1`.
   *
   * Kept as a separate flag rather than a doctored `initial`, because the
   * ticking below recomputes from the real time every second and would
   * quietly slam a forced-open door shut again a second after it opened.
   */
  forceOpen?: boolean;
}) {
  const [clock, setClock] = useState<DraftClock>(initial);
  const [tension, setTension] = useState(tensionOverride ?? 0);
  const [sound, setSound] = useState(false);
  const open = forceOpen || clock.open;
  const level = chaosLevel(tension);

  useEffect(() => {
    // Positive when the device is running behind the server. Includes the
    // flight time of the response, which biases us a shade late - the
    // right way to be wrong, since it opens the door a beat after the
    // server would rather than a beat before.
    const skew = serverNow - Date.now();
    const tick = () => {
      const now = Date.now() + skew;
      setClock(draftClock(now));
      if (tensionOverride === null) setTension(tensionAt(now, DRAFT_START_MS));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverNow, tensionOverride]);

  // The crescendo is a single class on <html>, so the poster above and
  // the counter below can both react without either needing to know the
  // clock. Set here because this is the only component that has it.
  useEffect(() => {
    const root = document.documentElement;
    const applied = `chaos-${level}`;
    root.classList.add(applied);
    return () => root.classList.remove(applied);
  }, [level]);

  // The beeping. Only ever after somebody has switched sound on - which
  // is both good manners on a page people will leave open for days, and
  // the gesture browsers require before any audio will play at all.
  useEffect(() => {
    if (!sound || open) return;
    const every = BEEP_INTERVAL_MS[level];
    if (!every) return;
    const id = setInterval(() => playBeep(tension), every);
    return () => clearInterval(id);
  }, [sound, level, tension, open]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-8 border-t-4 border-[#2a1f18] bg-[#14100d] px-5 py-8 sm:px-14 sm:py-11">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Two spans rather than one string. Press Start 2P is a full em
            per character, so this line is thirty ems wide and will not
            wrap at a separator on its own - left whole it drags the
            entire page wider than the phone it is being read on. */}
        <span className="font-arcade text-[11px] leading-relaxed text-[#e8a33d] sm:text-[17px]">
          <span className="whitespace-nowrap">SATURDAY · AUGUST 29</span>{" "}
          <span className="whitespace-nowrap">· 5:00 PM PDT</span>
        </span>
        <span className="font-plex text-[11px] uppercase tracking-[0.2em] text-[#8a7c68] sm:text-xs">
          Snake draft · 12 teams
        </span>

        {!open && (
          <button
            type="button"
            onClick={() => {
              // The click that unlocks audio, and the first beep, in one -
              // so switching it on proves it works instead of leaving you
              // waiting to find out.
              setSound((on) => {
                if (!on) playBeep(tension);
                return !on;
              });
            }}
            className="font-plex mt-1 self-start border border-[#3b2f26] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.22em] text-[#8a7c68] transition-colors hover:border-[#6b5340] hover:text-[#e8a33d]"
            aria-pressed={sound}
          >
            {sound ? "◧ Sound on" : "◧ Sound off"}
          </button>
        )}

        {tensionOverride !== null && (
          <span className="font-plex mt-1 self-start border border-dashed border-[#6b5340] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#c1391f]">
            Preview · tension {tension.toFixed(2)} · {LEVEL_NAMES[level]} (
            {level}/4)
          </span>
        )}
      </div>

      {open ? (
        <div className="ml-auto flex flex-col items-end gap-4">
          <Link
            href={enterHref}
            className="font-arcade border-4 border-[#efe6d2] bg-[#e8a33d] px-6 py-5 text-[13px] text-[#14100d] shadow-[9px_9px_0_#c1391f] transition-[transform,box-shadow,background-color] hover:translate-x-1 hover:translate-y-1 hover:bg-[#f6d38a] hover:shadow-[5px_5px_0_#c1391f] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#efe6d2] sm:px-9 sm:py-6 sm:text-[18px]"
          >
            ENTER THE DRAFT ROOM
          </Link>
          <span className="font-arcade animate-opa-blink text-[9px] text-[#c1391f] sm:text-[11px]">
            THE ROOM IS OPEN.
          </span>
        </div>
      ) : (
        <div className="ml-auto flex flex-col items-end gap-7 sm:gap-8">
          {/* Two objects, deliberately kept apart: a clock, and the door
              it is holding shut.

              They were briefly one bordered block with the numbers
              stacked above the words, which read as a single strange
              control rather than as a countdown and an entrance. The
              clock keeps its own cells, the door keeps the shape and
              position of the live button so the same thing lights up at
              five o'clock, and there is real space between them. The door
              is dashed and flat where the live one is solid with a hard
              offset shadow - the whole difference between a thing you may
              press and a thing you may not. */}
          <div
            className="flex gap-2 sm:gap-3"
            // Read as one unit when it changes, rather than four separate
            // numbers shouting over each other every second.
            role="timer"
            aria-live="off"
            aria-label={`${clock.days} days, ${clock.hours} hours, ${clock.minutes} minutes and ${clock.seconds} seconds until the draft room opens`}
          >
            <Cell value={clock.days} label="Days" />
            <Cell value={clock.hours} label="Hrs" />
            <Cell value={clock.minutes} label="Min" />
            <Cell value={clock.seconds} label="Sec" accent />
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            {/* Not a <button disabled>, which is a control that exists and
                refuses. There is nothing to press here yet. */}
            <span
              aria-disabled="true"
              className="font-arcade cursor-not-allowed border-4 border-dashed border-[#3b2f26] px-6 py-5 text-center text-[11px] leading-relaxed text-[#6b5340] sm:px-9 sm:py-6 sm:text-[18px]"
            >
              ENTER THE DRAFT ROOM
            </span>
            {/* Capped so it wraps onto two lines on a phone. At a full em
                per character this tagline is forty-eight ems long, which
                is wider than any phone made. */}
            <span className="font-arcade animate-opa-blink max-w-[17rem] text-center text-[9px] leading-loose text-[#c1391f] sm:max-w-none sm:text-right sm:text-[11px]">
              SOME SEARCH FOR BATTLE. OTHERS ARE BORN INTO IT.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex min-w-[62px] flex-col items-center gap-2 border-[3px] bg-[#0f0c0a] px-2 py-3 sm:min-w-[96px] sm:px-2.5 sm:py-3.5 ${
        accent ? "opa-sec-cell border-[#c1391f]" : "border-[#6b5340]"
      }`}
    >
      <span
        className={`font-arcade text-[18px] tabular-nums sm:text-[26px] ${
          accent ? "text-[#e8a33d]" : "text-[#efe6d2]"
        }`}
      >
        {value}
      </span>
      <span className="font-plex text-[9px] uppercase tracking-[0.22em] text-[#8a7c68] sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}
