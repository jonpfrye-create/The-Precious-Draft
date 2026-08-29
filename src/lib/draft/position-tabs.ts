import { POSITIONS } from "../positions";
import type { SlotSpec } from "./roster-fit";

/**
 * Which position tabs a phase should offer.
 *
 * Derived from the phase's own roster slots rather than listed per phase,
 * for the same reason roster rules are: change the roster shape and the
 * tabs follow it. Three complaints from the practice draft are one rule
 * here - Main showed a kicker tab nobody can start, Microwave offered all
 * six positions when it only drafts three, and neither screen had a way
 * to look at the flex positions together.
 *
 * A position earns a tab when a *starting* slot can hold it. Bench slots
 * in this league accept everything (see supabase/schema.sql), so counting
 * them would put all six positions on every screen and say nothing.
 *
 * Kickers in Main are the case worth stating out loud: Main has no K slot
 * outside the bench, so there is no kicker tab, and that is deliberate.
 * They are still draftable and still reachable through search - the tab
 * is a browsing aid, not a permission. `canFillRoster` remains the only
 * thing that decides what may actually be picked.
 */

/** The list every phase opens on. Not a position - see matchesTab. */
export const ALL_TAB = "All";

/** The flex group, as the league says it out loud. */
export const FLEX_TAB = "W/R/T";

export const FLEX_POSITIONS: readonly string[] = ["RB", "WR", "TE"];

/**
 * Tabs for a phase, in reading order: All, then the positions a starter
 * slot admits, with the flex group sitting after TE where it belongs.
 *
 * The flex tab only appears when at least two of its positions are
 * startable - in a phase that only drafts running backs it would be a
 * second name for the RB tab.
 */
export function positionTabs(slots: readonly SlotSpec[]): string[] {
  const startable = new Set<string>();
  for (const slot of slots) {
    if (slot.isBench) continue;
    for (const position of slot.eligiblePositions) startable.add(position);
  }

  const tabs: string[] = [ALL_TAB];
  const flexCount = FLEX_POSITIONS.filter((p) => startable.has(p)).length;

  for (const position of POSITIONS) {
    if (!startable.has(position)) continue;
    tabs.push(position);
    // Sits directly after TE, so the group reads as a widening of the
    // three tabs before it rather than an extra position on the end.
    if (position === "TE" && flexCount >= 2) tabs.push(FLEX_TAB);
  }

  // A phase with startable flex positions but no TE slot still gets the
  // group, just at the end of them.
  if (flexCount >= 2 && !tabs.includes(FLEX_TAB)) tabs.push(FLEX_TAB);

  return tabs;
}

/** Whether a player belongs under the given tab. */
export function matchesTab(tab: string, position: string | null): boolean {
  if (tab === ALL_TAB) return true;
  if (tab === FLEX_TAB) return position !== null && FLEX_POSITIONS.includes(position);
  return position === tab;
}

/**
 * The tab to open on, given what this phase offers.
 *
 * Always "All" while it exists. The board used to open filtered to
 * quarterbacks because it took the first entry of POSITIONS, which is a
 * fine default for a sheet of stickers and a poor one for a list.
 */
export function defaultTab(tabs: readonly string[]): string {
  return tabs[0] ?? ALL_TAB;
}
