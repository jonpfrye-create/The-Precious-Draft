import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { commissionerDestination } from "@/lib/draft/navigation";

// Which redirect fires depends on live DB state - never prerender this.
export const dynamic = "force-dynamic";

export default async function CommishEntry() {
  // The (protected) layout already gates this, but resolving the league
  // here is what tells us whether setup has been run yet.
  const league = await requireCommissionerLeague();
  redirect(await commissionerDestination(league.id));
}
