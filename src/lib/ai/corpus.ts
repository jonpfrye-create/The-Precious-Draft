/**
 * The corpus is every grade the commissioner has written by hand, paired
 * with the roster it was written about. It is what Clams AI imitates.
 *
 * It lives in a repo file rather than in the database on purpose. Grades
 * cascade from leagues, so the throwaway test league takes its grades with
 * it when deleted, and next year's draft is a different league row
 * entirely. The corpus has to outlive both. See scripts/export-voice.ts.
 */

/**
 * The commissioner's stated views, as opposed to his worked examples.
 *
 * These are the only source besides the roster that Clams AI may draw a
 * claim from, and they are a different kind of input: the examples teach
 * it how he writes, these teach it what he thinks. Without them it has no
 * opinions of its own and falls back on consensus - a good impression of
 * his voice saying things he'd never say.
 *
 * Both are free text, written by hand in voice/*.md.
 */
export interface VoiceContext {
  philosophy: string;
  players: string;
}

export const EMPTY_CONTEXT: VoiceContext = { philosophy: "", players: "" };

/**
 * The part of a voice file that is actually his.
 *
 * Everything above the first `---` is guidance addressed to the human -
 * what the file is for, how to write it. Only what follows is content.
 * Without this boundary the model reads instructions written *about* the
 * file as opinions written *in* it, and grades a team against "say things
 * the way you'd say them out loud".
 *
 * HTML comments are stripped too, so the placeholder prompts left in the
 * template don't count as writing either.
 */
export function sectionBody(section: string): string {
  const afterRule = section.split(/^---\s*$/m).slice(1).join("\n---\n");
  const body = afterRule || section;
  return body.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** Whether he has actually written anything in a voice file yet. */
export function hasContent(section: string): boolean {
  return sectionBody(section).replace(/^#+.*$/gm, "").trim().length > 0;
}

export interface CorpusEntry {
  key: string;
  league: string;
  phase: string;
  team: string;
  grade: string;
  comment: string;
  roster: string;
  exportedAt: string;
}

/**
 * A stable identifier for one graded team, matching what export-voice
 * writes. Uuids can't be used: the test league is deleted and recreated
 * with fresh ids, and the corpus has to recognise the same team across
 * that.
 */
export function corpusKey(
  league: string,
  phase: string,
  team: string
): string {
  return `${league}|${phase}|${team}`;
}

/**
 * The examples to show when grading one particular team.
 *
 * Everything about this feature rests on one guarantee: Clams AI must
 * never have seen the commissioner's grade for the team it is grading. If
 * it has, the reveal is a magic trick where the audience watched you load
 * the card - the machine is reciting, not predicting.
 *
 * The caller could filter this itself, and callers forget. Enforcing it
 * here means the guarantee holds no matter who calls it.
 */
export function examplesFor(
  targetKey: string,
  corpus: readonly CorpusEntry[]
): CorpusEntry[] {
  return corpus.filter((entry) => entry.key !== targetKey);
}

/**
 * How grades are distributed across the corpus, e.g. "B: 4, B-: 2".
 *
 * Without this a model hands out A- to everyone, because praise is the
 * default register of anything trained on the internet. This league's
 * grades cluster, and where they cluster is part of the voice.
 */
export function gradeDistribution(
  corpus: readonly CorpusEntry[]
): { grade: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of corpus) {
    counts.set(entry.grade, (counts.get(entry.grade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => b.count - a.count || a.grade.localeCompare(b.grade));
}

/** Mean comment length in words, so the generated ones match the format. */
export function averageCommentWords(corpus: readonly CorpusEntry[]): number {
  if (corpus.length === 0) return 40;
  const total = corpus.reduce(
    (n, e) => n + e.comment.trim().split(/\s+/).length,
    0
  );
  return Math.round(total / corpus.length);
}
