import { redirect } from "next/navigation";
import { normalizeCode } from "@/lib/auth/codes";
import { findLeagueIdByLeagueCode } from "@/lib/auth/secrets";
import { claimedTeamIds } from "@/lib/auth/claims";
import {
  getDrafterTeam,
  getLeagueCodeFromSession,
  startLeagueSession,
} from "@/lib/auth/drafter";
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

  // A code in the link wins over whatever this browser last used, so a
  // fresh link always lands in the league it names.
  const { code: fromLink } = await searchParams;
  if (fromLink) {
    const normalized = normalizeCode(fromLink);
    const found = await findLeagueIdByLeagueCode(normalized);
    if (found) {
      await startLeagueSession(normalized);
      redirect("/join");
    }
  }

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
