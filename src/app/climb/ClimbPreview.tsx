"use client";

import { useState } from "react";
import Climb from "@/components/Climb";
import { hashString } from "@/lib/random/seeded";
import type { ClimbTeam, Felling } from "@/lib/climb/climb";

/**
 * Drives the rehearsal from a button instead of from the commissioner.
 *
 * The finishing order is a hash of the team ids - stable, so the same
 * rehearsal can be run twice and compared, and demonstrably nothing to
 * do with the shuffle that decides the real thing.
 */
export default function ClimbPreview({
  teams,
  myTeamId,
}: {
  teams: ClimbTeam[];
  myTeamId: string;
}) {
  const [seedNo, setSeedNo] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const seed = `rehearsal:${seedNo}`;

  const order = [...teams].sort(
    (a, b) =>
      hashString(`${seed}:${a.teamId}`) - hashString(`${seed}:${b.teamId}`)
  );
  const n = order.length;
  const fellings: Felling[] = order
    .map((t, i) => ({ position: i + 1, teamId: t.teamId }))
    .filter((f) => f.position > n - revealed);

  return (
    <div className="flex flex-col gap-4">
      <Climb
        // Remounts on a new draw, so the rehearsal starts from the
        // trailhead rather than teleporting the survivors back down.
        key={`${seed}:${revealed === 0 ? "fresh" : "run"}`}
        teams={teams}
        fellings={fellings}
        seed={seed}
        myTeamId={myTeamId}
        fieldSize={n}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={revealed >= n}
          onClick={() => setRevealed((r) => Math.min(n, r + 1))}
          className="font-arcade border-4 border-[#efe6d2] bg-[#e8a33d] px-5 py-3 text-[10px] text-[#14100d] shadow-[6px_6px_0_#c1391f] transition-[transform,box-shadow] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0_#c1391f] disabled:opacity-40 sm:text-[13px]"
        >
          {revealed >= n ? "SUMMIT REACHED" : "FELL THE NEXT ONE"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed(0);
            setSeedNo((s) => s + 1);
          }}
          className="font-plex text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
        >
          Back to the trailhead
        </button>
      </div>
    </div>
  );
}
