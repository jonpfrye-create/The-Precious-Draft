"use server";

import { getDrafterTeamForAction } from "@/lib/auth/drafter";
import { getCommissionerLeague } from "@/lib/auth/commissioner";
import { getPhaseById, searchPool } from "@/lib/draft/queries";
import type { SheetPlayer } from "@/lib/draft/queries";

/**
 * Looking up someone the trimmed sheet left behind.
 *
 * A phone carries the few hundred most draftable players, not all 4,254.
 * That is fine until the last rounds, when somebody wants a specific
 * handcuff nobody has ranked - so the rest of the pool stays reachable,
 * one search at a time, without being shipped in advance.
 *
 * Guarded like everything else: a server action is its own endpoint, so
 * it establishes for itself that the caller belongs to this league.
 */
export async function searchDeepPool(
  phaseId: string,
  query: string
): Promise<SheetPlayer[]> {
  const phase = await getPhaseById(phaseId);
  if (!phase) return [];

  const [commissioner, drafter] = await Promise.all([
    getCommissionerLeague(),
    getDrafterTeamForAction(),
  ]);
  const allowed =
    commissioner?.id === phase.league_id || drafter?.leagueId === phase.league_id;
  if (!allowed) return [];

  return searchPool(phase, query);
}
