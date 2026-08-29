"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Listens for a league's phases changing, from any device.
 *
 * This is what carries the draft order reveal to the ten people who
 * aren't in the room. Every press of the reveal button writes two things:
 * the `revealed` flag on a `phase_teams` row, and the running total on
 * `phases.order_revealed_count`. Only the second one is watched here,
 * because it changes on every single press and `phases` is already in the
 * publication - so one subscription covers the whole reveal, and the same
 * subscription catches the phase going `active` when the draft starts.
 *
 * Every event, not just UPDATE. Starting Leftovers *inserts* a phase
 * rather than updating one, so a subscription watching updates alone
 * heard nothing at all: on the practice night every drafter sat on a
 * finished Main board while the commissioner drew the next order, and
 * only a manual reload moved them. The reveal is an update and the new
 * phase is an insert; both have to arrive.
 *
 * Requires supabase/008-realtime.sql. Without it the subscription still
 * succeeds and simply goes quiet, which is indistinguishable from a
 * commissioner who hasn't pressed anything yet - the exact failure that
 * went unnoticed on `picks` until a probe insert proved it.
 */
export function useLeaguePhases(
  leagueId: string | null,
  onPhaseChange: () => void
) {
  // Held in a ref so a caller passing an inline arrow function doesn't
  // tear down and rebuild the subscription on every render. Assigned in
  // an effect rather than during render, which React forbids.
  const handler = useRef(onPhaseChange);
  useEffect(() => {
    handler.current = onPhaseChange;
  }, [onPhaseChange]);

  useEffect(() => {
    if (!leagueId) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`league-phases:${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "phases",
          filter: `league_id=eq.${leagueId}`,
        },
        () => handler.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);
}
