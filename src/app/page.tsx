import Image from "next/image";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  isValidCommissionerSecretShape,
  normalizeCode,
} from "@/lib/auth/codes";

// Shows a live player count - must never be statically prerendered.
export const dynamic = "force-dynamic";

/**
 * The front door, as a film poster.
 *
 * The league renames itself every year after a film with "Precious"
 * wedged into the title; this year it's One Precious After Another, so
 * the commissioner is the one on the one-sheet. The billing block is the
 * whole league, in draft order of nothing in particular, and the studio
 * credit at the bottom buries Clicky Draft where the gravestone used to.
 */

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
  searchParams: Promise<{ secret?: string }>;
}) {
  // A commissioner link normally jumps straight to the board, which skips
  // this page entirely. Handing someone "/?secret=..." instead lets them
  // see the poster first and then walk in - the front door rather than
  // the side entrance.
  //
  // The shape is checked before it goes anywhere near an href, so a junk
  // query param is ignored rather than reflected back into the page.
  const { secret } = await searchParams;
  const normalized = normalizeCode(secret ?? "");
  const entryHref = isValidCommissionerSecretShape(normalized)
    ? `/commish/enter?secret=${normalized}`
    : "/commish";

  const supabase = createBrowserSupabaseClient();
  const { count, error } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#08090c] px-4 py-10">
      <div className="animate-poster-in w-full max-w-[540px]">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
          <Image
            src="/james.png"
            alt="James, in profile against the ocean"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 540px"
            className="poster-shot"
          />

          {/* Darkroom passes, in order: grade, lift, grain. */}
          <div aria-hidden className="poster-grade absolute inset-0" />
          <div aria-hidden className="poster-lift absolute inset-0" />
          <div aria-hidden className="poster-grain absolute inset-0" />

          {/* Top matter */}
          <div className="absolute inset-x-0 top-0 px-6 pt-6 text-center">
            <p className="billing text-[9px] text-white/70 sm:text-[10px]">
              The Precious Draft presents &middot; a Jonny Clams production
            </p>
          </div>

          {/* Title and billing */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-5 text-center">
            <p className="billing mb-2 text-[10px] tracking-[0.34em] text-[#f0b46a] sm:text-[11px]">
              James
            </p>

            <h1 className="poster-title text-[clamp(2.6rem,12vw,4.6rem)] text-[#f6efe2] drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
              One Precious
              <br />
              After Another
            </h1>

            <p className="billing mt-3 text-[9px] tracking-[0.3em] text-white/75 sm:text-[10px]">
              Draft Day &middot; August 29
            </p>

            {/* The billing block, set the way real ones are: everything
                in one unbroken condensed run, too small to read
                comfortably and there to be read anyway. */}
            <p className="billing mt-3 max-w-[92%] text-[6.5px] leading-[1.7] text-white/55 sm:text-[7.5px]">
              The Precious Draft presents a Jonny Clams production &ldquo;One
              Precious After Another&rdquo; starring {CAST.join(" · ")} casting
              by Sleeper &middot; average draft position by Fantasy Football
              Calculator &middot; grades by Clams AI &middot; snake order drawn
              live &middot; no pick timer &middot; in loving memory of Clicky
              Draft 2020&ndash;2025
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href={entryHref}
          className="rounded-sm bg-[#e8622c] px-10 py-4 text-lg font-bold uppercase tracking-[0.2em] text-[#1a0a04] transition-transform hover:scale-105"
        >
          Enter the draft
        </Link>
        <p className="text-xs text-zinc-600">
          {error
            ? `Player pool unavailable: ${error.message}`
            : `${count?.toLocaleString()} players in the pool`}
        </p>
      </div>
    </div>
  );
}
