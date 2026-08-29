"use client";

import { useRouter } from "next/navigation";
import { usePhaseChannel } from "@/lib/realtime/usePhaseChannel";

/**
 * One subscription for a page that renders two boards.
 *
 * The phone board and the laptop board are both mounted on every load and
 * one of them is hidden in CSS, which is what keeps the right one on
 * screen from the first paint. If each owned its own subscription they
 * would open two channels on the same topic - `phase:<id>` - and
 * unmounting either would take the other's channel with it. Twelve phones
 * would then sit on a board that had quietly stopped updating, which is
 * the hardest kind of failure to notice in a loud room.
 */
export default function BoardSync({ phaseId }: { phaseId: string }) {
  const router = useRouter();
  usePhaseChannel(phaseId, () => router.refresh());
  return null;
}
