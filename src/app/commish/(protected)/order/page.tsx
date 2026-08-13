import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import {
  getCurrentPhase,
  getPicks,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import OrderDraw from "./OrderDraw";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const league = await requireCommissionerLeague();
  const phase = await getCurrentPhase(league.id);
  if (!phase) redirect("/commish/setup");

  const [teams, picks] = await Promise.all([
    getTeamsForPhase(phase.id),
    getPicks(phase.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-zinc-500">
          {phase.type} draft
        </p>
        <h1 className="text-4xl font-semibold">Draft order</h1>
      </div>
      <OrderDraw phase={phase} teams={teams} picksMade={picks.length} />
    </div>
  );
}
