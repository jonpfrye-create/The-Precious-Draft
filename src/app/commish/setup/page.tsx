import Link from "next/link";
import { redirect } from "next/navigation";
import { checkSetupAccess } from "@/lib/auth/setup-access";
import { getCommissionerLeague } from "@/lib/auth/commissioner";
import { commissionerDestination } from "@/lib/draft/navigation";
import SetupForm from "./SetupForm";

// Access depends on live DB state (whether any league exists yet).
export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  // Deliberately outside the (protected) group: on an empty database there
  // is no commissioner secret yet, so this page has to be reachable to
  // mint the first one. See lib/auth/setup-access.ts.
  const access = await checkSetupAccess();
  if (!access.allowed) redirect("/commish/login");

  const league = await getCommissionerLeague();
  const { confirm } = await searchParams;

  // A commissioner who already has a league should never land on a blank
  // new-league form by accident - submitting it would create a second
  // league and silently strand them. They get a way out first, and have to
  // ask for the form explicitly.
  if (league && confirm !== "new") {
    const destination = await commissionerDestination(league.id);
    return (
      <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-6 py-16 dark:bg-black">
        <h1 className="text-3xl font-semibold">You already have a league</h1>
        <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
          <strong>{league.name}</strong> is already set up. This page creates
          a brand new league from scratch — it isn&apos;t how you start
          Leftovers or Microwave.
        </p>
        <Link
          href={destination}
          className="rounded bg-black px-6 py-4 text-lg font-medium text-white dark:bg-white dark:text-black"
        >
          Back to {league.name} →
        </Link>
        <Link
          href="/commish/setup?confirm=new"
          className="text-sm text-zinc-500 hover:underline"
        >
          No, set up a completely new league
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-3xl font-semibold">Set up the Main draft</h1>
      {league && (
        <p className="max-w-md rounded border border-amber-400 bg-amber-50 p-4 text-center text-sm dark:border-amber-700 dark:bg-amber-950/40">
          This creates a <strong>second</strong> league alongside{" "}
          {league.name}, with its own commissioner link. You almost certainly
          don&apos;t want this mid-season.
        </p>
      )}
      <SetupForm />
    </div>
  );
}
