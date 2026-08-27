"use server";

import { redirect } from "next/navigation";
import { getDrafterTeamForAction, endDrafterSession } from "@/lib/auth/drafter";
import { releaseClaim } from "@/lib/auth/claims";
import { getCurrentPhase, getPicks } from "@/lib/draft/queries";
import { ACTION_FAILED } from "@/lib/errors";

export interface ReleaseResult {
  ok: boolean;
  error?: string;
}

/**
 * Giving back a team you took by mistake.
 *
 * The one that gets picked wrong at five past five, either because
 * somebody tapped the row above theirs or because somebody else got to
 * the phone first. Until this existed the only fix was the commissioner
 * opening /commish/claims, which makes him the bottleneck for the
 * single most likely mishap of the night.
 *
 * Deliberately narrow. It releases *your own* team, taken from your own
 * cookie - never a team id sent up from the page, which would let anyone
 * who could read this action's id knock any manager off any team. And it
 * stops working the moment a pick exists: after that a release orphans
 * real picks, and it goes back to being the commissioner's call.
 *
 * `/draft/leave` is a different thing and stays as it is - that signs a
 * handset out without giving up the team, which is what you want when a
 * phone is being passed around.
 */
export async function releaseMyTeam(): Promise<ReleaseResult> {
  const me = await getDrafterTeamForAction();
  if (!me) return { ok: false, error: "You don't currently hold a team." };

  const phase = await getCurrentPhase(me.leagueId);
  if (phase) {
    if (phase.status !== "pending") {
      return {
        ok: false,
        error: "The draft has started. Ask the commissioner to move you.",
      };
    }

    const picks = await getPicks(phase.id);
    if (picks.length > 0) {
      return {
        ok: false,
        error: "Picks have been made. Ask the commissioner to move you.",
      };
    }
  }

  try {
    await releaseClaim(me.leagueId, me.teamId);
  } catch {
    return { ok: false, error: ACTION_FAILED };
  }

  // The claim is gone, so this device's token now points at nothing. The
  // league code is kept: they are about to pick a different team in the
  // same league and should not have to type it again.
  await endDrafterSession();
  redirect("/join");
}
