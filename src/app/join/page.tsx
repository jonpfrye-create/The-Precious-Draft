import { redirect } from "next/navigation";
import { findLeagueIdByLeagueCode } from "@/lib/auth/secrets";
import { claimedTeamIds } from "@/lib/auth/claims";
import { getDrafterTeam, getLeagueCodeFromSession } from "@/lib/auth/drafter";
import { getCurrentPhase, getLeagueById, getTeamsForLeague } from "@/lib/draft/queries";
import CodeForm from "./CodeForm";
import TeamPicker from "./TeamPicker";

export const dynamic = "force-dynamic";

/**
 * The drafters' front door.
 *
 * One page, two states: type the league code, then take your team. Kept
 * as one route because on the night this is read off a screen and typed
 * on a phone by someone holding a drink, and a flow with fewer places to
 * get lost is worth more than tidy URLs.
 *
 * `?code=` is accepted so the commissioner can send a link rather than
 * make twelve people type six characters correctly.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Already holding a team - nothing to do here.
  const existing = await getDrafterTeam();
  if (existing) redirect("/draft");

  // Handing the code to the route handler rather than acting on it here:
  // a server component cannot set a cookie, and the first version of this
  // tried to, which silently did nothing and dropped people on the code
  // form wondering why the link had not worked.
  const { code: fromLink } = await searchParams;
  if (fromLink) redirect(`/join/enter?code=${encodeURIComponent(fromLink)}`);

  const code = await getLeagueCodeFromSession();
  const leagueId = code ? await findLeagueIdByLeagueCode(code) : null;

  if (!leagueId) return <CodeForm />;

  const [league, teams, taken, phase] = await Promise.all([
    getLeagueById(leagueId),
    getTeamsForLeague(leagueId),
    claimedTeamIds(leagueId),
    getCurrentPhase(leagueId),
  ]);

  return (
    <TeamPicker
      leagueName={league?.name ?? "the league"}
      leagueCode={code ?? ""}
      // Two leagues can hold teams with identical names, so the state of
      // the draft is shown here rather than discovered after claiming.
      phaseLabel={phase ? phase.type : null}
      teams={[...teams]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ id: t.id, name: t.name, taken: taken.has(t.id) }))}
    />
  );
}
