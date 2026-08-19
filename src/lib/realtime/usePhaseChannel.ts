"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Listens for picks landing in a phase, from any device.
 *
 * Every screen in the room is watching the same draft: the television,
 * and twelve phones. Before this, each one only found out about a pick
 * when its own owner did something, which made the draft feel like twelve
 * separate applications that happened to share a database.
 *
 * The callback is deliberately not `router.refresh` by default. A refresh
 * refetches the whole page, and on the drafter's screen that is a hundred
 * and thirty kilobytes for a change that amounts to one player becoming
 * unavailable. Callers that can update their own state do so; only the
 * ones that genuinely need new server data refresh.
 *
 * Requires supabase/008-realtime.sql, which publishes the table, and
 * 009-undo-realtime.sql, which makes deletes carry enough of the row for
 * the filter below to match them. Without either, the subscription still
 * succeeds and simply goes quiet - which is indistinguishable from a
 * draft where nobody is picking, and is how both omissions went unnoticed
 * until a probe insert proved it.
 */
export function usePhaseChannel(
  phaseId: string | null,
  onPickChange: () => void
) {
  // Held in a ref so a caller passing an inline arrow function doesn't
  // tear down and rebuild the subscription on every render. Assigned in an
  // effect rather than during render, which React forbids.
  const handler = useRef(onPickChange);
  useEffect(() => {
    handler.current = onPickChange;
  }, [onPickChange]);

  useEffect(() => {
    if (!phaseId) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`phase:${phaseId}`)
      .on(
        "postgres_changes",
        {
          // INSERT for a pick, DELETE for an undo - the board has to walk
          // backwards as convincingly as it walks forwards.
          event: "*",
          schema: "public",
          table: "picks",
          filter: `phase_id=eq.${phaseId}`,
        },
        () => handler.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phaseId]);
}
