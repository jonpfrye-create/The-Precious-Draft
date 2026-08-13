"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { startCommissionerSession } from "@/lib/auth/commissioner";
import { createLeagueSecrets } from "@/lib/auth/secrets";
import { checkSetupAccess } from "@/lib/auth/setup-access";

export interface RosterSlotInput {
  slotName: string;
  eligiblePositions: string[];
  isBench: boolean;
}

export interface CreateMainPhaseInput {
  leagueName: string;
  teamNames: string[]; // in draft order
  rosterSlots: RosterSlotInput[];
}

export async function createLeagueAndMainPhase(input: CreateMainPhaseInput) {
  // Same rule the page enforces, re-checked here because a server action is
  // a separate HTTP endpoint that can be invoked without ever loading the
  // page. See lib/auth/setup-access.ts for why this isn't a flat gate.
  const access = await checkSetupAccess();
  if (!access.allowed) {
    throw new Error(
      "Commissioner access required to create a league. Open your commissioner link and try again."
    );
  }

  const leagueName = input.leagueName.trim();
  const teamNames = input.teamNames.map((n) => n.trim()).filter(Boolean);
  const rosterSlots = input.rosterSlots.filter((s) => s.slotName.trim());

  if (!leagueName) throw new Error("League name is required");
  if (teamNames.length < 2) throw new Error("Add at least two teams");
  if (rosterSlots.length < 1) throw new Error("Add at least one roster slot");

  const supabase = createAdminSupabaseClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({ name: leagueName })
    .select("id")
    .single();
  if (leagueError) throw leagueError;

  // Mint this league's codes immediately, and move the commissioner's
  // session onto the league they just created - otherwise someone setting
  // up a second league would be bounced back to the first one's board.
  const secrets = await createLeagueSecrets(league.id);
  await startCommissionerSession(secrets.commissionerSecret);

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .insert(teamNames.map((name) => ({ league_id: league.id, name })))
    .select("id, name");
  if (teamsError) throw teamsError;

  // Preserve the order the commissioner entered teams in, since insert()
  // doesn't guarantee row order matches input order.
  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
  const orderedTeamIds = teamNames.map((name) => {
    const id = teamIdByName.get(name);
    teamIdByName.delete(name); // handle duplicate team names one at a time
    if (!id) throw new Error(`Failed to create team: ${name}`);
    return id;
  });

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .insert({
      league_id: league.id,
      type: "main",
      sequence: 1,
      status: "active",
      rounds: rosterSlots.length,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (phaseError) throw phaseError;

  const { error: phaseTeamsError } = await supabase.from("phase_teams").insert(
    orderedTeamIds.map((team_id, index) => ({
      phase_id: phase.id,
      team_id,
      draft_position: index + 1,
    }))
  );
  if (phaseTeamsError) throw phaseTeamsError;

  const { error: rosterSlotsError } = await supabase.from("roster_slots").insert(
    rosterSlots.map((slot, index) => ({
      phase_id: phase.id,
      slot_order: index + 1,
      slot_name: slot.slotName.trim(),
      eligible_positions: slot.eligiblePositions,
      is_bench: slot.isBench,
    }))
  );
  if (rosterSlotsError) throw rosterSlotsError;

  return { phaseId: phase.id as string };
}
