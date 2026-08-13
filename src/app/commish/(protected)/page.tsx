import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { getCurrentPhase } from "@/lib/draft/queries";

// Which redirect fires depends on live DB state - never prerender this.
export const dynamic = "force-dynamic";

export default async function CommishEntry() {
  // The (protected) layout already gates this, but resolving the league
  // here is what tells us whether setup has been run yet.
  const league = await requireCommissionerLeague();
  const phase = await getCurrentPhase(league.id);
  if (!phase) redirect("/commish/setup");
  redirect("/commish/board");
}
