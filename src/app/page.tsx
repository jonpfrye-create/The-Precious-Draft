import Link from "next/link";
import Countdown from "./Countdown";
import { draftClock } from "@/lib/draft/draft-clock";
import {
  isValidCommissionerSecretShape,
  isValidLeagueCodeShape,
  normalizeCode,
} from "@/lib/auth/codes";

/**
 * The front door: an 8-bit one-sheet with a countdown that turns into the
 * way in.
 *
 * Every year the league renames itself after a film with "Precious"
 * wedged into the title, and this year it is One Precious After Another,
 * so the commissioner goes where DiCaprio was - dithered, filling the
 * sky, with the mascot standing on the road underneath.
 *
 * This is a link sent round the league ten days early, so it has to hold
 * two states without anybody touching it in between. It counts down
 * until 5:00 PM Pacific on 29 August and then shows the door instead.
 * The flip happens in the browser, which is not a detail: the one thing
 * that must not happen that day is a deploy (see CLAUDE.md), so a page
 * that needs shipping to change state would be a page that could not
 * change state.
 *
 * The counter is scenery, not a lock. `/join` is open the whole time and
 * always was - the draft is gated by the league code, not by the clock.
 * Anyone who finds the counter and tries the URL anyway gets exactly
 * what they would have got yesterday.
 */

// Required, not decorative. The countdown's first reading is taken here,
// on the server, and handed to the browser as the authority on what time
// it is. Let this page go static and that reading would be frozen at
// build time, so the poster would insist there were ten days left on the
// night itself.
export const dynamic = "force-dynamic";

const CAST = [
  "James",
  "Chris",
  "Enzo",
  "David",
  "Sam",
  "Jon",
  "Scott",
  "Larry",
  "Parker",
  "Phil",
  "Brandon",
  "Deonte",
];

const HARDWARE = [
  {
    name: "THE PRECIOUS",
    border: "#e8a33d",
    tint: "rgba(232,163,61,0.06)",
    line: "First place. Handed over in silence, reclaimed without ceremony.",
  },
  {
    name: "LEFTOVERS",
    border: "#6b5340",
    tint: "transparent",
    line: "Everything between glory and disgrace. Nobody has asked to see it.",
  },
  {
    name: "MICROWAVE",
    border: "#c1391f",
    tint: "rgba(193,57,31,0.07)",
    line: "Last place. It heats things. That is the whole of the punishment.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string; code?: string; open?: string }>;
}) {
  const params = await searchParams;

  // Both codes are passed straight through to the doors that know what to
  // do with them, and both are shape-checked before they go anywhere near
  // an href so a junk query param is dropped rather than reflected back
  // into the page.
  //
  // `?code=` means the commissioner can post one link to the league chat
  // and nobody has to type six characters correctly on a phone. The bare
  // domain stays safe to paste anywhere, because without the code it
  // leads to the code form and no further.
  const secret = normalizeCode(params.secret ?? "");
  const code = normalizeCode(params.code ?? "");

  const commissionerHref = isValidCommissionerSecretShape(secret)
    ? `/commish/enter?secret=${secret}`
    : "/commish";
  const enterHref = isValidLeagueCodeShape(code)
    ? `/join?code=${code}`
    : "/join";

  // The escape hatch. If the draft slips, or it has to be opened early to
  // show someone, `?open=1` opens the door without a deploy - which on
  // the day is the difference between a fix and a broken room.
  const forceOpen = params.open === "1";

  // Reading the clock during a render is normally a bug, and the rule
  // below is right to say so - a component that re-renders would get a
  // different answer each time and drift out of step with itself. This
  // one cannot: it is an async server component on a `force-dynamic`
  // route, so it runs exactly once per request, on the server, and the
  // reading it takes is the whole point. It is handed to the browser as
  // the authority on the time rather than being re-read there.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();
  const initial = draftClock(serverNow);

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#17140f] px-3 py-6 sm:px-8 sm:py-12">
      <div className="w-full max-w-[1180px] border-2 border-[#2a1f18] bg-[#0b0908] text-[#efe6d2]">
        <div className="opa-stage">
          <div aria-hidden className="opa-sun" />
          <div aria-hidden className="opa-road" />
          <div aria-hidden className="opa-verge" />
          <div aria-hidden className="opa-dashes" />

          {/* Plain <img> rather than next/image on purpose. Both are
              hand-dithered pixel art already sized for the page and
              together weigh 120KB; putting them through the optimiser
              resamples the dither into mush and bills for the privilege. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/james-8bit.png"
            alt="James, the commissioner, rendered in 8-bit and filling the sky"
            width={1728}
            height={1840}
            className="opa-james"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot-8bit.png"
            alt="The league mascot, as an 8-bit sprite, standing in the road"
            width={610}
            height={1640}
            className="opa-mascot"
          />

          <div className="opa-billboard animate-opa-jitter">
            <p className="opa-presents">The Commissioner Presents</p>
            <h1 className="opa-title">
              <span>ONE</span>
              <span>PRECIOUS</span>
              <span>AFTER</span>
              <span>ANOTHER</span>
            </h1>
            <p className="opa-season font-plex">
              Season XVIII · Twelve teams · Snake draft
            </p>
          </div>

          <div aria-hidden className="opa-scan" />
        </div>

        <Countdown
          initial={initial}
          serverNow={serverNow}
          enterHref={enterHref}
          forceOpen={forceOpen}
        />

        <div className="flex flex-col gap-10 bg-[#0f0c0a] px-6 py-12 sm:px-14 sm:py-14">
          <section className="flex flex-col gap-6">
            <h2 className="font-arcade text-[11px] text-[#e8a33d] sm:text-[13px]">
              THE HARDWARE
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {HARDWARE.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col items-center gap-3 border-[3px] px-5 py-7 text-center"
                  style={{ borderColor: item.border, background: item.tint }}
                >
                  <span className="font-arcade text-[12px] sm:text-[14px]">
                    {item.name}
                  </span>
                  <span className="font-plex text-[11px] leading-[1.85] text-[#a3937d] sm:text-xs">
                    {item.line}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* The billing block, set the way real ones are: one unbroken
              condensed run, too small to read comfortably and there to be
              read anyway. */}
          <p className="font-plex max-w-[820px] self-center text-center text-[7px] leading-[2] tracking-[0.14em] text-[#7d6f5e] uppercase sm:text-[9px]">
            The Precious Draft presents &ldquo;One Precious After
            Another&rdquo; starring {CAST.join(" · ")} · casting by Sleeper ·
            average draft position by Fantasy Football Calculator · grades by
            Clams AI · snake order drawn live · no pick timer · three drafts,
            one shrinking pool · in loving memory of Clicky Draft 2020&ndash;2025
          </p>

          {/* Not in the poster, and deliberately quiet. The commissioner
              still has to get in to draw the order and start the phase,
              and the counter must never be the thing standing between him
              and his own draft. */}
          <Link
            href={commissionerHref}
            className="font-plex self-center text-[10px] uppercase tracking-[0.3em] text-[#4d4438] underline-offset-4 transition-colors hover:text-[#e8a33d] hover:underline"
          >
            Commissioner
          </Link>
        </div>
      </div>
    </main>
  );
}
