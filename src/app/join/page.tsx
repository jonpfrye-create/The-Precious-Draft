import { redirect } from "next/navigation";
import { findLeagueIdByLeagueCode } from "@/lib/auth/secrets";
import { claimedTeamIds } from "@/lib/auth/claims";
import { getDrafterTeam, getLeagueCodeFromSession } from "@/lib/auth/drafter";
import { getLeagueById, getTeamsForLeague } from "@/lib/draft/queries";
import CodeForm from "./CodeForm";
import TeamPicker from "./TeamPicker";

export const dynamic = "force-dynamic";

/**
 * The drafters' front door.
 *
 * One page, two states: type the league code, then take your team. Kept
 * as one route because on the night this is read off a screen and typed
 * on a phone by someone who has been handed a drink, and a flow with
 * fewer places to get lost is worth more than tidy URLs.
 */
export default async function JoinPage() {
  // Already holding a team - nothing to do here.
  const existing = await getDrafterTeam();
  if (existing) redirect("/draft");

  const code = await getLeagueCodeFromSession();
  const leagueId = code ? await findLeagueIdByLeagueCode(code) : null;

  if (!leagueId) return <CodeForm />;

  const [league, teams, taken] = await Promise.all([
    getLeagueById(leagueId),
    getTeamsForLeague(leagueId),
    claimedTeamIds(leagueId),
  ]);

  return (
    <TeamPicker
      leagueName={league?.name ?? "the league"}
      teams={[...teams]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ id: t.id, name: t.name, taken: taken.has(t.id) }))}
    />
  );
}
