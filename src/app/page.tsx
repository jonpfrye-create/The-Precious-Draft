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
 * the commissioner goes where DiCaprio was. It is a mashup made of CSS
 * rather than a composite - the photograph is graded rust and amber to
 * meet the reference, and the layout borrows its bones: one enormous
 * face, the title stacked in white beside it, a road running out at the
 * bottom.
 *
 * The face sits on the right rather than the left, which is the one
 * place this departs from the original. Mirroring the photo would put
 * him on the correct side and reverse the lettering on his shirt and the
 * flag on his sleeve, which reads as a mistake rather than a joke.
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#08070a] px-4 py-10">
      <div className="animate-poster-in w-full max-w-[520px]">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
          <div className="poster-face absolute inset-0">
            <Image
              src="/james.png"
              alt="James, in profile against the ocean"
              fill
              priority
              // Deliberately soft. It's a mashup pulled together out of a
              // holiday photo, and a pin-sharp one would look like it was
              // trying to pass for the real thing.
              quality={55}
              sizes="(max-width: 640px) 100vw, 520px"
              className="poster-shot"
            />
          </div>

          {/* Darkroom passes, in order: grade, sun lift, road, grain. */}
          <div aria-hidden className="poster-grade absolute inset-0" />
          <div aria-hidden className="poster-lift absolute inset-0" />
          <div aria-hidden className="poster-road absolute inset-x-0 bottom-0 h-[34%]" />
          <div aria-hidden className="poster-grain absolute inset-0" />

          {/* Title, stacked left of the face the way the reference stacks
              it right of DiCaprio. */}
          <div className="absolute left-0 top-[34%] w-full px-5">
            <h1 className="poster-title text-left text-[clamp(2.1rem,9.4vw,3.4rem)] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.95)]">
              One
              <br />
              Precious
              <br />
              After
              <br />
              Another
            </h1>
          </div>

          {/* Bottom matter */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-4 text-center">
            <p className="billing text-[10px] tracking-[0.34em] text-[#f0a05a] sm:text-[11px]">
              James
            </p>
            <p className="billing mt-1 text-[9px] tracking-[0.3em] text-white/70 sm:text-[10px]">
              Draft Day &middot; August 29
            </p>

            {/* The billing block, set the way real ones are: one unbroken
                condensed run, too small to read comfortably and there to
                be read anyway. */}
            <p className="billing mt-2 max-w-[94%] text-[6px] leading-[1.7] text-white/45 sm:text-[7px]">
              The Precious Draft presents &ldquo;One Precious After
              Another&rdquo; starring {CAST.join(" · ")} casting by Sleeper
              &middot; average draft position by Fantasy Football Calculator
              &middot; grades by Clams AI &middot; snake order drawn live
              &middot; no pick timer &middot; in loving memory of Clicky Draft
              2020&ndash;2025
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
