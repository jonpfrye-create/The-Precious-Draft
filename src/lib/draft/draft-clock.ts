/**
 * The countdown on the front door.
 *
 * The landing page is a locked poster until the draft opens, at which
 * point the counter is replaced by the way in. That flip has to happen
 * on its own, in every browser that already has the page open, because
 * the one thing we cannot do on 29 August is deploy - see CLAUDE.md.
 * So the target is a fixed instant and the page works out where it
 * stands against it, rather than the door being opened by hand.
 */

/**
 * 5:00 PM Pacific on Saturday 29 August 2026, written as the UTC instant
 * it actually is.
 *
 * Deliberately not "2026-08-29T17:00:00" with a timezone applied later.
 * Half the league drafts from the room and half from wherever they are;
 * an instant is the same moment for all of them, whereas a wall-clock
 * time means twelve different answers. PDT is UTC-7, so 17:00 there is
 * midnight UTC on the 30th.
 */
export const DRAFT_START_ISO = "2026-08-30T00:00:00Z";

export const DRAFT_START_MS = Date.parse(DRAFT_START_ISO);

export type DraftClock = {
  /** True once the target has passed - the way in replaces the counter. */
  open: boolean;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Where `now` stands against the draft, as four already-padded strings.
 *
 * Padded here rather than in the markup so the four boxes never change
 * width as the numbers fall - a counter that reflows every time it ticks
 * past ten looks broken.
 */
export function draftClock(
  nowMs: number,
  targetMs: number = DRAFT_START_MS
): DraftClock {
  const left = Math.max(0, targetMs - nowMs);
  const open = left === 0;
  const total = Math.floor(left / 1000);

  return {
    open,
    // Days are not padded to two on purpose past 99 - it is a count, not
    // a dial, and truncating it would be worse than a wider box.
    days: pad(Math.floor(total / 86400)),
    hours: pad(Math.floor(total / 3600) % 24),
    minutes: pad(Math.floor(total / 60) % 60),
    seconds: pad(total % 60),
  };
}
