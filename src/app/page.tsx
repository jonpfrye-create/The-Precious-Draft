import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { unitFromSeed } from "@/lib/random/seeded";
import {
  isValidCommissionerSecretShape,
  normalizeCode,
} from "@/lib/auth/codes";

// Shows a live player count - must never be statically prerendered.
export const dynamic = "force-dynamic";

// Stars are placed from a hash rather than Math.random: randomness during
// render isn't allowed, and would re-scatter them on every request anyway.
const STARS = Array.from({ length: 60 }, (_, i) => ({
  key: i,
  left: unitFromSeed(`star:${i}:x`) * 100,
  top: unitFromSeed(`star:${i}:y`) * 62,
  size: 1 + unitFromSeed(`star:${i}:s`) * 2,
  opacity: 0.25 + unitFromSeed(`star:${i}:o`) * 0.75,
  delay: unitFromSeed(`star:${i}:d`) * 4,
}));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  // A commissioner link normally jumps straight to the board, which skips
  // this page entirely. Handing someone "/?secret=..." instead lets them
  // see the graveyard first and then walk in - the front door rather than
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#05070f] via-[#0b1020] to-[#161022]">
      {/* Night sky */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((star) => (
          <span
            key={star.key}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
        <div
          className="absolute right-[12%] top-[10%] h-24 w-24 rounded-full bg-[#f5f0dc] opacity-80"
          style={{ boxShadow: "0 0 70px 20px rgba(245,240,220,0.28)" }}
        />
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-end pb-0">
        {/* The ghost, rising */}
        <div className="animate-rise flex flex-col items-center px-6 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.5em] text-emerald-300/70">
            It rises
          </p>
          <h1
            className="text-5xl font-black uppercase leading-[0.9] tracking-tight text-emerald-100 sm:text-7xl md:text-8xl"
            style={{
              textShadow:
                "0 0 18px rgba(110,231,183,0.65), 0 0 48px rgba(52,211,153,0.45), 0 0 90px rgba(16,185,129,0.3)",
            }}
          >
            The Precious
            <br />
            Draft
          </h1>
        </div>

        {/* Graveyard */}
        <div className="relative mt-6 flex w-full justify-center">
          <svg
            viewBox="0 0 320 220"
            className="h-[280px] w-[380px] md:h-[340px] md:w-[460px]"
            role="img"
            aria-label="A gravestone reading Clicky Draft, Rest In Pieces"
          >
            {/* Glow leaking out of the grave */}
            <ellipse
              cx="160"
              cy="196"
              rx="96"
              ry="16"
              fill="rgba(52,211,153,0.22)"
              className="animate-grave-glow"
            />

            {/* Headstone, leaning the way old stones do */}
            <g transform="rotate(-2.5 160 150)">
              <path
                d="M104 196 V96 a56 56 0 0 1 112 0 V196 Z"
                fill="#4b5563"
              />
              <path
                d="M110 190 V98 a50 50 0 0 1 100 0 V190 Z"
                fill="#6b7280"
              />
              <text
                x="160"
                y="86"
                textAnchor="middle"
                className="fill-zinc-300"
                style={{ font: "700 15px system-ui", letterSpacing: "3px" }}
              >
                R.I.P.
              </text>
              <text
                x="160"
                y="126"
                textAnchor="middle"
                className="fill-zinc-200"
                style={{ font: "800 21px system-ui" }}
              >
                CLICKY
              </text>
              <text
                x="160"
                y="150"
                textAnchor="middle"
                className="fill-zinc-200"
                style={{ font: "800 21px system-ui" }}
              >
                DRAFT
              </text>
              <text
                x="160"
                y="170"
                textAnchor="middle"
                className="fill-zinc-300"
                style={{ font: "700 13px system-ui", letterSpacing: "1px" }}
              >
                2020 &ndash; 2025
              </text>
              <text
                x="160"
                y="186"
                textAnchor="middle"
                className="fill-zinc-400"
                style={{ font: "600 11px system-ui", letterSpacing: "1px" }}
              >
                rest in pieces
              </text>
            </g>

            {/* Ground */}
            <path
              d="M0 196 Q80 186 160 196 T320 194 V220 H0 Z"
              fill="#14121c"
            />
            <path
              d="M0 200 Q80 192 160 200 T320 198"
              fill="none"
              stroke="rgba(52,211,153,0.18)"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Doors */}
        <div className="relative z-10 -mt-6 flex flex-col items-center gap-4 pb-12">
          <Link
            href={entryHref}
            className="rounded-lg bg-emerald-400 px-8 py-4 text-lg font-bold uppercase tracking-wider text-emerald-950 transition-transform hover:scale-105"
          >
            Enter the draft
          </Link>
          <p className="text-xs text-zinc-500">
            {error
              ? `Player pool unavailable: ${error.message}`
              : `${count?.toLocaleString()} players in the pool`}
          </p>
        </div>
      </main>
    </div>
  );
}
