import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCommissionerLeague } from "@/lib/auth/commissioner";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getPhasesForLeague,
  getPicks,
  getPlayersByIds,
  getRosterSlots,
  getTeamsForPhase,
} from "@/lib/draft/queries";
import { assignRoster } from "@/lib/draft/roster-fit";
import { corpusSize, hasStatedViews } from "@/lib/ai/clams";
import GradeCard from "./GradeCard";
import SealAllButton from "./SealAllButton";

export const dynamic = "force-dynamic";

export default async function GradesPage() {
  const league = await requireCommissionerLeague();
  const phases = await getPhasesForLeague(league.id);

  // Grades are for the Main draft only - Leftovers and Microwave are two
  // and nine picks of scraps, and nobody grades those.
  const main = phases.find((p) => p.sequence === 1);
  if (!main) redirect("/commish/setup");

  const [teams, slots, picks] = await Promise.all([
    getTeamsForPhase(main.id),
    getRosterSlots(main.id),
    getPicks(main.id),
  ]);
  const players = await getPlayersByIds(picks.map((p) => p.player_id));
  const playerById = new Map(players.map((p) => [p.player_id, p]));

  const supabase = createAdminSupabaseClient();
  const { data: grades } = await supabase
    .from("team_grades")
    .select("team_id, grade, comment")
    .eq("phase_id", main.id)
    .eq("source", "commissioner");
  const gradeByTeam = new Map(
    (grades ?? []).map((g) => [g.team_id, g])
  );

  const { data: clamsRows } = await supabase
    .from("team_grades")
    .select("team_id, grade, comment, model, sealed_at, revealed_at")
    .eq("phase_id", main.id)
    .eq("source", "ai");
  const clamsByTeam = new Map((clamsRows ?? []).map((g) => [g.team_id, g]));

  const slotSpecs = slots.map((slot) => ({
    slotName: slot.slot_name,
    eligiblePositions: slot.eligible_positions,
  }));

  const graded = teams.filter((t) => gradeByTeam.has(t.id)).length;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <h1 className="text-3xl font-semibold">Draft grades</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {league.name} — Main draft. {graded} of {teams.length} graded.
          Grades save as you click; comments save when you click away.
        </p>
        <Link
          href="/commish/board"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to the board
        </Link>
      </div>

      <div className="w-full max-w-3xl">
        <SealAllButton
          phaseId={main.id}
          unsealed={teams.filter((t) => !clamsByTeam.has(t.id)).length}
          corpusSize={corpusSize()}
          hasViews={hasStatedViews()}
        />
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-4">
        {teams.map((team) => {
          // Same slot assignment the Yahoo export uses, so a team's roster
          // reads the same way in both places.
          const teamPlayers = picks
            .filter((pick) => pick.team_id === team.id)
            .map((pick) => playerById.get(pick.player_id))
            .filter((p) => p !== undefined);

          // Where each player was taken, shown against the slot he ended
          // up in. Reading "RB1 — pick 120" in one line is most of what
          // grading a starting lineup actually involves.
          const pickByPlayer = new Map(
            picks.filter((p) => p.team_id === team.id).map((p) => [p.player_id, p])
          );

          const roster = assignRoster(teamPlayers, slotSpecs).map(
            (assignment) => {
              const pick = assignment.player
                ? pickByPlayer.get(assignment.player.player_id)
                : undefined;
              return {
                slotName: assignment.slot.slotName,
                playerName: assignment.player?.full_name ?? null,
                position: assignment.player?.position ?? null,
                nflTeam: assignment.player?.nfl_team ?? null,
                round: pick?.round ?? null,
                pickInRound: pick
                  ? ((pick.pick_number - 1) % teams.length) + 1
                  : null,
                overall: pick?.pick_number ?? null,
                adp: assignment.player?.adp ?? null,
              };
            }
          );

          const existing = gradeByTeam.get(team.id);
          const clams = clamsByTeam.get(team.id);

          // A sealed grade is stripped here, not hidden with CSS. Sending
          // it down and rendering it invisible would leave the answer one
          // devtools panel away, on a laptop in a room full of people who
          // would think spoiling it was funny.
          const revealed = Boolean(clams?.revealed_at);

          return (
            <GradeCard
              key={team.id}
              phaseId={main.id}
              teamId={team.id}
              teamName={team.name}
              roster={roster}
              initialGrade={existing?.grade ?? null}
              initialComment={existing?.comment ?? null}
              clams={{
                sealedAt: clams?.sealed_at ?? null,
                revealedAt: clams?.revealed_at ?? null,
                grade: revealed ? (clams?.grade ?? null) : null,
                comment: revealed ? (clams?.comment ?? null) : null,
                model: revealed ? (clams?.model ?? null) : null,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
