import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { fetchAllPlayers } from "../src/lib/draft/player-pool";
import { generateSnakeOrder } from "../src/lib/draft/snake-order";
import { availablePlayersForPhase } from "../src/lib/draft/pool-exclusion";
import { isPositionDraftable } from "../src/lib/draft/roster-fit";

// Fills in a draft automatically, taking best-available for every pick.
//
//   npm run simulate                 finish the current phase
//   npm run simulate -- --picks 20   make only the first 20 picks
//
// Two jobs. It's how the phase cascade gets tested - Leftovers excluding
// Main's picks can't be verified without a completed Main draft, and
// nobody is entering 168 picks by hand. And it's the basis of the demo the
// commissioner needs to sign this off without a real draft.

// Hard safety rail: this writes picks, so it must never be able to touch
// a real league. Only leagues built by test-league.ts qualify, recognised
// by the same "ZZZ " prefix the app uses.
//
//   npm run simulate -- --league "ZZZ Commish Demo"
const DEMO_PREFIX = "ZZZ ";

function requestedLeagueName(): string {
  const index = process.argv.indexOf("--league");
  const value = index === -1 ? undefined : process.argv[index + 1];
  const name = value ?? "ZZZ Draw Test";
  if (!name.startsWith(DEMO_PREFIX)) {
    console.error(`Refusing to simulate against "${name}" - not a demo league.`);
    process.exit(1);
  }
  return name;
}

const ALLOWED_LEAGUE_NAME = requestedLeagueName();

function parsePickLimit(): number | null {
  const index = process.argv.indexOf("--picks");
  if (index === -1) return null;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

async function main() {
  const supabase = createAdminSupabaseClient();
  const limit = parsePickLimit();

  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("name", ALLOWED_LEAGUE_NAME);
  if (leagueError) throw leagueError;
  if (!leagues || leagues.length === 0) {
    console.error(
      `No "${ALLOWED_LEAGUE_NAME}" league found. Create one with:\n` +
        `  npm run test-league\n\n` +
        `This script refuses to run against any other league.`
    );
    process.exit(1);
  }
  const league = leagues[0];

  const { data: phases, error: phaseError } = await supabase
    .from("phases")
    .select("id, type, sequence, status, rounds")
    .eq("league_id", league.id)
    .neq("status", "completed")
    .order("sequence", { ascending: true })
    .limit(1);
  if (phaseError) throw phaseError;
  if (!phases || phases.length === 0) {
    console.log("No phase in progress — every phase is complete.");
    return;
  }
  const phase = phases[0];

  const { data: phaseTeams, error: teamsError } = await supabase
    .from("phase_teams")
    .select("team_id, draft_position, teams (name)")
    .eq("phase_id", phase.id)
    .order("draft_position", { ascending: true });
  if (teamsError) throw teamsError;

  const { data: slots, error: slotsError } = await supabase
    .from("roster_slots")
    .select("slot_name, eligible_positions, is_bench")
    .eq("phase_id", phase.id)
    .order("slot_order", { ascending: true });
  if (slotsError) throw slotsError;

  const slotSpecs = (slots ?? []).map((s) => ({
    slotName: s.slot_name,
    eligiblePositions: s.eligible_positions as string[],
  }));

  // Everything picked in earlier phases, which is what the cascade excludes.
  const { data: priorPhases } = await supabase
    .from("phases")
    .select("id, sequence")
    .eq("league_id", league.id)
    .lt("sequence", phase.sequence);

  const priorPhasePicks: { sequence: number; playerIds: string[] }[] = [];
  for (const prior of priorPhases ?? []) {
    const { data: priorPicks } = await supabase
      .from("picks")
      .select("player_id")
      .eq("phase_id", prior.id);
    priorPhasePicks.push({
      sequence: prior.sequence,
      playerIds: (priorPicks ?? []).map((p) => p.player_id),
    });
  }

  const allPlayers = await fetchAllPlayers(supabase);
  const positionById = new Map(
    allPlayers.map((p) => [p.player_id, p.position])
  );

  const { data: existingPicks } = await supabase
    .from("picks")
    .select("player_id, team_id, pick_number")
    .eq("phase_id", phase.id)
    .order("pick_number", { ascending: true });

  const takenThisPhase = (existingPicks ?? []).map((p) => p.player_id);
  const draftedByTeam = new Map<string, (string | null)[]>();
  for (const pick of existingPicks ?? []) {
    const list = draftedByTeam.get(pick.team_id) ?? [];
    list.push(positionById.get(pick.player_id) ?? null);
    draftedByTeam.set(pick.team_id, list);
  }

  const snakeOrder = generateSnakeOrder(
    (phaseTeams ?? []).map((t) => t.team_id),
    phase.rounds
  );
  const nameByTeamId = new Map(
    (phaseTeams ?? []).map((t) => [
      t.team_id,
      (t.teams as unknown as { name: string }).name,
    ])
  );

  const startAt = takenThisPhase.length;
  const endAt = limit ? Math.min(startAt + limit, snakeOrder.length) : snakeOrder.length;

  console.log(
    `\n${phase.type} draft: ${startAt} of ${snakeOrder.length} picks made. ` +
      `Simulating ${endAt - startAt} more.\n`
  );

  for (let i = startAt; i < endAt; i++) {
    const onTheClock = snakeOrder[i];
    const drafted = draftedByTeam.get(onTheClock.teamId) ?? [];

    // Best available that this team actually has a slot for - the same
    // rule the board enforces.
    const available = availablePlayersForPhase(
      allPlayers,
      priorPhasePicks,
      phase.sequence,
      takenThisPhase
    );
    const choice = available.find((p) =>
      isPositionDraftable(drafted, p.position, slotSpecs)
    );
    if (!choice) {
      console.error(
        `No legal pick for ${nameByTeamId.get(onTheClock.teamId)} at pick ${onTheClock.overallPick}.`
      );
      process.exit(1);
    }

    const { error: insertError } = await supabase.from("picks").insert({
      phase_id: phase.id,
      team_id: onTheClock.teamId,
      player_id: choice.player_id,
      pick_number: onTheClock.overallPick,
      round: onTheClock.round,
    });
    if (insertError) throw insertError;

    takenThisPhase.push(choice.player_id);
    draftedByTeam.set(onTheClock.teamId, [...drafted, choice.position]);

    if (onTheClock.overallPick % 25 === 0 || onTheClock.overallPick <= 3) {
      console.log(
        `  pick ${String(onTheClock.overallPick).padStart(3)} ` +
          `${nameByTeamId.get(onTheClock.teamId)} -> ${choice.full_name} (${choice.position})`
      );
    }
  }

  const complete = endAt >= snakeOrder.length;
  if (complete) {
    const { error: completeError } = await supabase
      .from("phases")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", phase.id);
    if (completeError) throw completeError;
    console.log(`\n${phase.type} draft complete (${snakeOrder.length} picks).`);
  } else {
    console.log(`\nStopped at ${endAt} of ${snakeOrder.length} picks.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
