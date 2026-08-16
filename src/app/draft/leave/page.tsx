import { redirect } from "next/navigation";
import Link from "next/link";
import { getDrafterTeam, endDrafterSession } from "@/lib/auth/drafter";
import { splitTeamName } from "@/lib/teams/branding";

export const dynamic = "force-dynamic";

/**
 * Letting go of a team on this device.
 *
 * Deliberately does not release the claim itself - only the commissioner
 * can do that. Someone tapping "not your team" on a phone should not be
 * able to knock the rightful owner off it, and the far likelier case is
 * two people sharing a handset or a phone being handed round.
 */
export default async function LeavePage() {
  const me = await getDrafterTeam();
  if (!me) redirect("/join");

  const { teamName } = splitTeamName(me.teamName);

  async function forget() {
    "use server";
    await endDrafterSession();
    redirect("/join");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sign out of {teamName}?</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This phone will stop being able to pick. The team stays claimed — if
        it&apos;s genuinely the wrong team, ask the commissioner to hand it
        back first.
      </p>
      <form action={forget}>
        <button
          type="submit"
          className="w-full rounded-lg border-2 border-red-300 px-6 py-4 font-semibold text-red-700 dark:border-red-800 dark:text-red-400"
        >
          Sign out
        </button>
      </form>
      <Link href="/draft" className="text-sm text-blue-600 dark:text-blue-400">
        ← Back to the draft
      </Link>
    </main>
  );
}
