import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { scoutTeam, describeReport, type ScoutedPickInput } from "../src/lib/draft/scouting";
import { sectionBody } from "../src/lib/ai/corpus";
import type { ScoutingSlot } from "../src/lib/draft/scouting";

/**
 * Saves every grade the commissioner has written, together with the exact
 * roster it was written about, into a file in the repo.
 *
 * Why this exists: grades live in `team_grades`, which cascades from
 * phases, which cascades from leagues. `npm run test-league -- --rm`
 * therefore deletes them. Grades written while trying the feature out are
 * the most valuable thing in the database - they are the only record of
 * how this commissioner grades - and they currently sit in the one league
 * designed to be thrown away.
 *
 * The file is the corpus the AI grader learns the voice from, so it also
 * needs to survive the far more ordinary loss: next year's draft, in a
 * different league row, on a different laptop. It goes in git.
 *
 * Run with: npm run export-voice
 */

const OUT_DIR = join(process.cwd(), "voice");
const JSON_PATH = join(OUT_DIR, "grade-corpus.json");
const MD_PATH = join(OUT_DIR, "grade-corpus.md");
const CONTEXT_PATH = join(OUT_DIR, "context.json");

/**
 * Folds the hand-written .md files into a json the app can import.
 *
 * The markdown is the human's copy - comfortable to write in and to read
 * back in a diff. The json is the bundler's copy: a static import is
 * included in the Vercel deployment, whereas reading a file at runtime
 * works locally and then silently returns nothing in production, leaving
 * Clams AI with no opinions and no error to show for it.
 */
function buildContext() {
  const read = (name: string) => {
    const path = join(OUT_DIR, name);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };

  const context = {
    philosophy: read("philosophy.md"),
    players: read("players.md"),
  };
  writeFileSync(CONTEXT_PATH, JSON.stringify(context, null, 2) + "\n");
  return context;
}

interface CorpusEntry {
  /** Stable across league teardown and recreation, unlike any uuid. */
  key: string;
  league: string;
  phase: string;
  team: string;
  grade: string;
  comment: string;
  /** The roster as prose, exactly as the grader will later see it. */
  roster: string;
  exportedAt: string;
}

async function main() {
  const supabase = createAdminSupabaseClient();

  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("id, name");
  if (leaguesError) throw leaguesError;

  const entries: CorpusEntry[] = [];

  for (const league of leagues ?? []) {
    const { data: phases } = await supabase
      .from("phases")
      .select("id, type")
      .eq("league_id", league.id);

    for (const phase of phases ?? []) {
      const { data: grades } = await supabase
        .from("team_grades")
        .select("team_id, grade, comment")
        .eq("phase_id", phase.id)
        .eq("source", "commissioner");
      if (!grades?.length) continue;

      const [{ data: slots }, { data: picks }, { data: phaseTeams }] =
        await Promise.all([
          supabase
            .from("roster_slots")
            .select("slot_name, eligible_positions, is_bench")
            .eq("phase_id", phase.id)
            .order("slot_order"),
          supabase
            .from("picks")
            .select("team_id, player_id, pick_number, round")
            .eq("phase_id", phase.id),
          supabase
            .from("phase_teams")
            .select("team_id, draft_position")
            .eq("phase_id", phase.id),
        ]);

      const teamIds = grades.map((g) => g.team_id);
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);
      const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
      const draftPos = new Map(
        (phaseTeams ?? []).map((t) => [t.team_id, t.draft_position])
      );

      const playerIds = [...new Set((picks ?? []).map((p) => p.player_id))];
      interface PoolPlayer {
        player_id: string;
        full_name: string;
        position: string | null;
        nfl_team: string | null;
        adp: number | null;
      }
      const players = new Map<string, PoolPlayer>();
      // Chunked: the id list for a full draft is long enough to matter in
      // a URL, and Supabase caps rows at 1000 regardless.
      for (let i = 0; i < playerIds.length; i += 200) {
        const { data } = await supabase
          .from("players")
          .select("player_id, full_name, position, nfl_team, adp")
          .in("player_id", playerIds.slice(i, i + 200));
        for (const p of data ?? []) players.set(p.player_id, p);
      }

      const slotSpecs: ScoutingSlot[] = (slots ?? []).map((s) => ({
        slotName: s.slot_name,
        eligiblePositions: s.eligible_positions,
        isBench: s.is_bench,
      }));

      for (const grade of grades) {
        if (!grade.comment?.trim()) continue; // A bare letter teaches nothing.

        const teamPicks: ScoutedPickInput[] = (picks ?? [])
          .filter((p) => p.team_id === grade.team_id)
          .map((p) => {
            const player = players.get(p.player_id);
            return {
              pickNumber: p.pick_number,
              round: p.round,
              player: {
                fullName: player?.full_name ?? "Unknown",
                position: player?.position ?? null,
                nflTeam: player?.nfl_team ?? null,
                adp: player?.adp ?? null,
              },
            };
          });

        const name = teamName.get(grade.team_id) ?? "Unknown team";
        const report = scoutTeam(
          name,
          draftPos.get(grade.team_id) ?? null,
          teamPicks,
          slotSpecs
        );

        entries.push({
          key: `${league.name}|${phase.type}|${name}`,
          league: league.name,
          phase: phase.type,
          team: name,
          grade: grade.grade,
          comment: grade.comment.trim(),
          roster: describeReport(report),
          exportedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Merge rather than overwrite. Once the test league is deleted its
  // grades vanish from the database, and a plain overwrite would then
  // quietly empty the corpus on the next run - losing exactly what this
  // script exists to protect.
  mkdirSync(OUT_DIR, { recursive: true });
  const existing: CorpusEntry[] = existsSync(JSON_PATH)
    ? JSON.parse(readFileSync(JSON_PATH, "utf8"))
    : [];

  const merged = new Map(existing.map((e) => [e.key, e]));
  let added = 0;
  let updated = 0;
  for (const entry of entries) {
    const before = merged.get(entry.key);
    if (!before) added++;
    else if (before.comment !== entry.comment || before.grade !== entry.grade) {
      updated++;
    }
    merged.set(entry.key, entry);
  }

  const all = [...merged.values()].sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(JSON_PATH, JSON.stringify(all, null, 2) + "\n");

  const md = [
    "# Grade corpus",
    "",
    "Every grade and comment written by hand, with the roster it was about.",
    "This is what the AI grader imitates - it is training data, not notes.",
    "Generated by `npm run export-voice`; edit the grades in the app, not here.",
    "",
    ...all.map((e) =>
      [
        `## ${e.team} - ${e.grade}`,
        `*${e.league} / ${e.phase}*`,
        "",
        "```",
        e.roster,
        "```",
        "",
        `> ${e.comment}`,
        "",
      ].join("\n")
    ),
  ].join("\n");
  writeFileSync(MD_PATH, md);

  const context = buildContext();
  // Counts only what he wrote, using the same boundary the prompt does,
  // so "53 words of views" can never mean "53 words of template".
  const words = (s: string) =>
    sectionBody(s).replace(/^#+.*$/gm, "").trim().split(/\s+/).filter(Boolean)
      .length;

  const kept = all.length - added - updated;
  console.log(`\nCorpus: ${all.length} graded teams with comments`);
  console.log(`  ${added} new, ${updated} updated, ${kept} already saved`);
  if (kept > entries.length - added - updated) {
    console.log(
      `  (some entries are no longer in the database - kept from the last export)`
    );
  }
  const philosophyWords = words(context.philosophy);
  const playerWords = words(context.players);
  console.log(
    `Stated views: ${philosophyWords} words on roster construction, ${playerWords} on players`
  );
  if (philosophyWords === 0 && playerWords === 0) {
    console.log(
      `  (both templates are still empty - Clams AI will grade against consensus ADP)`
    );
  }

  console.log(`\nWritten to:`);
  console.log(`  voice/grade-corpus.json`);
  console.log(`  voice/grade-corpus.md`);
  console.log(`  voice/context.json`);
  console.log(`\nCommit these - they are the only copy.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
