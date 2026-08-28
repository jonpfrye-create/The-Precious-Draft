import Link from "next/link";
import { requireDrafterTeam } from "@/lib/auth/drafter";
import {
  getCurrentPhase,
  getPhasesForLeague,
  getTeamsForLeague,
} from "@/lib/draft/queries";
import { assignTeamColors } from "@/lib/teams/branding";
import ClimbPreview from "./ClimbPreview";

export const dynamic = "force-dynamic";

/**
 * A rehearsal of the climb, on a field that is provably not the draft
 * order.
 *
 * This exists because the real thing can only be watched once, on the
 * night, and finding out then that it does not work on somebody's phone
 * is finding out far too late. Here the fellings are driven by a button
 * rather than by the commissioner, so the whole sequence can be run
 * through as many times as anyone likes.
 *
 * It never reads `phase_teams`, so there is nothing here that could show
 * a real draft position early - not even by accident, and not even for
 * the commissioner. The running order is derived from team ids and is
 * the same every time, which is exactly what makes it useless as a
 * prediction. The order that counts is drawn on the server and only ever
 * comes out through /lobby.
 */
export default async function ClimbPreviewPage() {
  const me = await requireDrafterTeam();

  const phases = await getPhasesForLeague(me.leagueId);
  const phase =
    (await getCurrentPhase(me.leagueId)) ?? phases[phases.length - 1];

  const leagueTeams = await getTeamsForLeague(me.leagueId);
  const colors = assignTeamColors(leagueTeams);

  const teams = [...leagueTeams]
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      hex: colors.get(t.id)?.hex ?? "#71717a",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="font-plex text-[11px] uppercase tracking-[0.24em] text-[#8a7c68]">
          {me.leagueName}
          {phase ? ` · ${phase.type}` : ""}
        </p>
        {/* No heading here on purpose. The mountain's name is painted
            at the top of the canvas instead - printed above it as an
            HTML title, it explained the reference before anyone had seen
            the thing it refers to. */}
      </header>

      <p className="font-plex border border-dashed border-[#6b5340] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#c1391f]">
        Rehearsal · not the draft order
      </p>

      <ClimbPreview teams={teams} myTeamId={me.teamId} />

      <Link
        href="/lobby"
        className="font-plex self-center text-xs text-zinc-500 underline-offset-4 hover:underline"
      >
        Back to the lobby
      </Link>
    </main>
  );
}
