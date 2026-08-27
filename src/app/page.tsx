import Countdown from "./Countdown";
import Hardware from "./Hardware";
import { draftClock } from "@/lib/draft/draft-clock";
import { currentSeasonNumber, toRoman } from "@/lib/league/history";
import { isValidLeagueCodeShape, normalizeCode } from "@/lib/auth/codes";

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; open?: string; tension?: string }>;
}) {
  const params = await searchParams;

  // Shape-checked before it goes anywhere near an href, so a junk query
  // param is dropped rather than reflected back into the page.
  //
  // `?code=` means the commissioner can post one link to the league chat
  // and nobody has to type six characters correctly on a phone. The bare
  // domain stays safe to paste anywhere, because without the code it
  // leads to the code form and no further.
  const code = normalizeCode(params.code ?? "");
  const enterHref = isValidLeagueCodeShape(code)
    ? `/join?code=${code}`
    : "/join";

  // The escape hatch. If the draft slips, or it has to be opened early to
  // show someone, `?open=1` opens the door without a deploy - which on
  // the day is the difference between a fix and a broken room.
  const forceOpen = params.open === "1";

  // `?tension=0.8` pins the crescendo anywhere on its curve. The build
  // runs over ten days and peaks in the final hour, so without this the
  // only way to see the loud end of it would be to wait for Saturday and
  // hope. Ignored unless it parses to a real 0..1.
  const requested = Number.parseFloat(params.tension ?? "");
  const tensionOverride =
    Number.isFinite(requested) && requested >= 0 && requested <= 1
      ? requested
      : null;

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
              Season {toRoman(currentSeasonNumber())} · Twelve teams · Snake
              draft
            </p>
          </div>

          {/* The billing block, set the way real ones are: one unbroken
              condensed run, too small to read comfortably and there to be
              read anyway. It sits on the road, under the mascot's feet,
              where a one-sheet puts it. */}
          <p className="opa-billing font-plex">
            The Precious Draft presents &ldquo;One Precious After
            Another&rdquo; starring {CAST.join(" · ")} · casting by Sleeper ·
            average draft position by Fantasy Football Calculator · grades by
            Clams AI · snake order drawn live · no pick timer · three drafts,
            one shrinking pool · in loving memory of Clicky Draft
            2020&ndash;2025
          </p>

          {/* A dropped frame of daylight, as the poster works itself up.
              Under the scanlines so it reads as the picture failing
              rather than something painted over it. */}
          <div aria-hidden className="opa-flicker-host">
            <div className="opa-flicker" />
          </div>

          <div aria-hidden className="opa-scan" />
        </div>

        <Countdown
          initial={initial}
          serverNow={serverNow}
          enterHref={enterHref}
          forceOpen={forceOpen}
          tensionOverride={tensionOverride}
        />

        <div className="bg-[#0f0c0a] px-6 py-12 sm:px-14 sm:py-14">
          <Hardware />
        </div>
      </div>
    </main>
  );
}
