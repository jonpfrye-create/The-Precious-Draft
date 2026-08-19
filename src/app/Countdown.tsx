"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { draftClock, type DraftClock } from "@/lib/draft/draft-clock";

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
}: {
  initial: DraftClock;
  serverNow: number;
  enterHref: string;
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
  const open = forceOpen || clock.open;

  useEffect(() => {
    // Positive when the device is running behind the server. Includes the
    // flight time of the response, which biases us a shade late - the
    // right way to be wrong, since it opens the door a beat after the
    // server would rather than a beat before.
    const skew = serverNow - Date.now();
    const tick = () => setClock(draftClock(Date.now() + skew));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverNow]);

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
        <div className="ml-auto flex flex-col items-end gap-4">
          <div
            className="flex gap-2 sm:gap-3"
            // Read as one unit when it changes, rather than four separate
            // numbers shouting over each other every second.
            role="timer"
            aria-live="off"
            aria-label={`${clock.days} days, ${clock.hours} hours, ${clock.minutes} minutes and ${clock.seconds} seconds until the draft`}
          >
            <Cell value={clock.days} label="Days" />
            <Cell value={clock.hours} label="Hrs" />
            <Cell value={clock.minutes} label="Min" />
            <Cell value={clock.seconds} label="Sec" accent />
          </div>
          {/* Capped so it wraps onto two lines on a phone. At a full em
              per character this tagline is forty-eight ems long, which is
              wider than any phone made. */}
          <span className="font-arcade animate-opa-blink max-w-[17rem] text-right text-[9px] leading-loose text-[#c1391f] sm:max-w-none sm:text-[11px]">
            SOME SEARCH FOR BATTLE. OTHERS ARE BORN INTO IT.
          </span>
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
        accent ? "border-[#c1391f]" : "border-[#6b5340]"
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
