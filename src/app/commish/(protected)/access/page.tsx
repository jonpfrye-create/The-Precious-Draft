import Link from "next/link";
import { headers } from "next/headers";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { ensureLeagueSecrets } from "@/lib/auth/secrets";
import AccessCodes from "./AccessCodes";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const league = await requireCommissionerLeague();
  const secrets = await ensureLeagueSecrets(league.id);

  // Built from the request's own host so the link works unchanged on
  // localhost, on a Vercel preview, and on the real domain.
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const commissionerLink = `${protocol}://${host}/commish/enter?secret=${secrets.commissionerSecret}`;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-3xl font-semibold">Access codes</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {league.name}
        </p>
      </div>

      <AccessCodes
        leagueCode={secrets.leagueCode}
        commissionerLink={commissionerLink}
      />

      <Link
        href="/commish/board"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to the draft board
      </Link>
    </div>
  );
}
