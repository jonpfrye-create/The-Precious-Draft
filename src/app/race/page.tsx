import Link from "next/link";
import { requireDrafterTeam } from "@/lib/auth/drafter";
import {
  getCurrentPhase,
  getPhasesForLeague,
  getTeamsForLeague,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { assignTeamColors } from "@/lib/teams/branding";
import { hashString } from "@/lib/random/seeded";
import { liveryRotation } from "@/lib/race/livery";
import RaceTrack, { type Racer } from "./RaceTrack";

export const dynamic = "force-dynamic";

/**
 * The mascot race.
 *
 * A side project, and deliberately off to one side: it reads the order,
 * never writes one, and nothing on the draft path knows this route
 * exists. The draw and the reveal are the highest-risk code in the
 * project and are not being touched for a novelty.
 *
 * Until the order has been fully revealed this races a *demo* field -
 * the same twelve names in an order derived from their ids, which is not
 * the drawn order and cannot be mistaken for it. Racing the real order
 * early would hand out the thing the reveal exists to protect, through a
 * side door, which is exactly how /draft was leaking it a week ago.
 */
export default async function RacePage() {
  const me = await requireDrafterTeam();

  const phases = await getPhasesForLeague(me.leagueId);
  const phase =
    (await getCurrentPhase(me.leagueId)) ?? phases[phases.length - 1];

  const [leagueTeams, phaseTeams] = await Promise.all([
    getTeamsForLeague(me.leagueId),
    phase ? getTeamsForPhase(phase.id) : Promise.resolve([]),
  ]);

  const revealed =
    phase !== null &&
    phase.order_drawn_at !== null &&
    phaseTeams.length > 0 &&
    phase.order_revealed_count >= phaseTeams.length;

  const colors = assignTeamColors(leagueTeams);
  const nameById = new Map(leagueTeams.map((t) => [t.id, t.name]));

  // The real finish order, or a stand-in that is provably not it.
  const order = revealed
    ? phaseTeams
        .slice()
        .sort((a, b) => a.draft_position - b.draft_position)
        .map((t) => t.id)
    : leagueTeams
        .map((t) => t.id)
        .sort((a, b) => hashString(`demo:${a}`) - hashString(`demo:${b}`));

  const racers: Racer[] = order.map((teamId) => {
    const hex = colors.get(teamId)?.hex ?? "#e8a33d";
    return {
      teamId,
      name: nameById.get(teamId) ?? "Unknown",
      hex,
      hue: liveryRotation(hex),
    };
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="font-plex text-[11px] uppercase tracking-[0.24em] text-[#8a7c68]">
          {me.leagueName}
          {phase ? ` · ${phase.type} draft` : ""}
        </p>
        <h1 className="font-arcade text-[16px] text-[#e8a33d] sm:text-[22px]">
          THE MASCOT RACE
        </h1>
        <p className="font-plex text-sm text-zinc-500">
          {revealed
            ? "Twelve mascots, one tape. The winner picks first — and the order was sealed before the gun."
            : "Exhibition race. The real order hasn't been drawn and revealed yet, so this field is a stand-in."}
        </p>
      </header>

      {!revealed ? (
        <p className="font-plex border border-dashed border-[#6b5340] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#c1391f]">
          Exhibition · not the draft order
        </p>
      ) : null}

      <RaceTrack racers={racers} seed={phase?.id ?? me.leagueId} />

      <Link
        href="/lobby"
        className="font-plex self-center text-xs text-zinc-500 underline-offset-4 hover:underline"
      >
        Back to the lobby
      </Link>
    </main>
  );
}
