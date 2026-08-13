"use client";

import { TEAM_PALETTE } from "@/lib/teams/branding";
import { unitFromSeed as unitFor } from "@/lib/random/seeded";

// Heavier than a token sprinkle - this is the one moment of the night
// that earns it.
const PIECE_COUNT = 220;

/**
 * Confetti for the first pick.
 *
 * Plain DOM elements with CSS animations rather than a canvas library: a
 * couple of hundred absolutely-positioned spans for a few seconds on a
 * machine doing nothing else, and it keeps the dependency list at zero.
 *
 * Every piece's position, speed and spin is derived deterministically from
 * its index and the accent colour rather than from Math.random. Randomness
 * during render isn't allowed (and would re-roll every piece on each
 * re-render, making them jump); a hash spreads them just as convincingly
 * and looks identical on screen.
 */


export default function Confetti({ accent }: { accent: string }) {
  // Mostly the winning team's colour plus gold, with the rest of the
  // palette scattered through so it reads as celebration, not a wash.
  const colors = [
    accent,
    "#FCD34D",
    accent,
    "#FFFFFF",
    ...TEAM_PALETTE.map((c) => c.hex),
  ];

  const pieces = Array.from({ length: PIECE_COUNT }, (_, i) => {
    const seed = `${accent}:${i}`;
    return {
      key: i,
      left: unitFor(`${seed}:x`) * 100,
      delay: unitFor(`${seed}:d`) * 2.8,
      duration: 4.2 + unitFor(`${seed}:t`) * 3.6,
      drift: (unitFor(`${seed}:r`) - 0.5) * 320,
      spin: 360 + unitFor(`${seed}:s`) * 1080,
      width: 11 + unitFor(`${seed}:w`) * 14,
      height: 16 + unitFor(`${seed}:h`) * 22,
      color: colors[i % colors.length],
    };
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.key}
          className="confetti-piece absolute top-[-8vh] block"
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--confetti-drift": `${piece.drift}px`,
              "--confetti-spin": `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
