import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { getCurrentPhase, getPhasesForLeague } from "@/lib/draft/queries";

// Which redirect fires depends on live DB state - never prerender this.
export const dynamic = "force-dynamic";

export default async function CommishEntry() {
  // The (protected) layout already gates this, but resolving the league
  // here is what tells us whether setup has been run yet.
  const league = await requireCommissionerLeague();
  const phase = await getCurrentPhase(league.id);

  if (!phase) {
    // No phase in progress. Either the league has never been set up, or a
    // phase just finished and the next one is waiting to be configured.
    // Sending the second case to /commish/setup would invite creating a
    // whole second league by accident.
    const phases = await getPhasesForLeague(league.id);
    redirect(phases.length === 0 ? "/commish/setup" : "/commish/next-phase");
  }

  redirect("/commish/board");
}
