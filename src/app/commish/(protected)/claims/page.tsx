import Link from "next/link";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { ensureLeagueSecrets } from "@/lib/auth/secrets";
import { claimedTeamIds } from "@/lib/auth/claims";
import { getTeamsForLeague } from "@/lib/draft/queries";
import ClaimList from "./ClaimList";

export const dynamic = "force-dynamic";

/**
 * Who has claimed which team, and the one button that undoes it.
 *
 * Also the place the league code is meant to be read from: the board
 * shows it too, but the board is on a television and this is not.
 */
export default async function ClaimsPage() {
  const league = await requireCommissionerLeague();
  const [teams, taken, { leagueCode }] = await Promise.all([
    getTeamsForLeague(league.id),
    claimedTeamIds(league.id),
    ensureLeagueSecrets(league.id),
  ]);

  const rows = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ id: t.id, name: t.name, claimed: taken.has(t.id) }));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Team claims</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {rows.filter((r) => r.claimed).length} of {rows.length} teams
          claimed. Drafters join at{" "}
          <span className="font-mono">/join</span> with the league code{" "}
          <span className="font-mono font-bold">{leagueCode}</span>.
        </p>
        <Link
          href="/commish/board"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to the board
        </Link>
      </div>

      <ClaimList teams={rows} />
    </div>
  );
}
