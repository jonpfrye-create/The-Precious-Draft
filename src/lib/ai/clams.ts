import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import corpusData from "../../../voice/grade-corpus.json";
import contextData from "../../../voice/context.json";
import { buildGradePrompt, parseGradeResponse } from "./grade-prompt";
import { corpusKey, hasContent, type CorpusEntry, type VoiceContext } from "./corpus";
import type { ScoutingReport } from "../draft/scouting";
import { describeReport } from "../draft/scouting";

/**
 * Clams AI: the commissioner's own grading voice, generated.
 *
 * The corpus is a static import rather than a file read, so it is bundled
 * into the deployment. Reading it from disk at runtime works locally and
 * then returns nothing on Vercel, which would silently degrade the whole
 * feature to a generic analyst with no examples - the one failure mode
 * that looks fine until it is on a television.
 */

const CORPUS = corpusData as CorpusEntry[];
const CONTEXT = contextData as VoiceContext;

// Voice imitation from a handful of examples is the hardest thing being
// asked here, and the entire feature is judged on whether it sounds like
// him. This is not the place to save a fraction of a cent.
const MODEL = "claude-opus-4-8";

export interface ClamsGrade {
  grade: string;
  comment: string;
  model: string;
  exampleCount: number;
}

export class ClamsNotConfiguredError extends Error {
  constructor() {
    super(
      "Clams AI needs an API key. Add ANTHROPIC_API_KEY to .env.local, and to the Vercel project settings for the live site."
    );
    this.name = "ClamsNotConfiguredError";
  }
}

/**
 * Grades one team in the commissioner's voice.
 *
 * `leagueName` and `phaseType` exist only to build the key that excludes
 * this team's own grade from the examples. Getting that key wrong would
 * not throw - it would quietly leak the answer into the prompt - so it is
 * built by the same helper the export uses rather than assembled here.
 */
export async function gradeLikeClams(
  leagueName: string,
  phaseType: string,
  report: ScoutingReport
): Promise<ClamsGrade> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClamsNotConfiguredError();

  const prompt = buildGradePrompt({
    targetRoster: describeReport(report),
    targetKey: corpusKey(leagueName, phaseType, report.teamName),
    corpus: CORPUS,
    context: CONTEXT,
  });

  const client = new Anthropic({ apiKey });

  // The system block - the rules plus his stated views - is identical for
  // every team in a sealing run, so it is cached and read back at a tenth
  // of the price on the eleven calls that follow the first.
  //
  // The examples deliberately are not cached. Each call leaves out the
  // grade for the team being graded, so there is no shared prefix to
  // cache, and the only way to create one would be to show every model
  // every grade - including the answer for the team in front of it. That
  // is the one thing this whole feature cannot do, and it is not for sale
  // at any discount.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: [
      // Everything up to and including this block is cached. The grade
      // distribution and word target come after it, because both are
      // derived from the leave-one-out set and so differ for every team.
      {
        type: "text",
        text: prompt.systemStable,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: prompt.systemVariable },
    ],
    messages: [{ role: "user", content: prompt.user }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  const parsed = parseGradeResponse(text);
  if (!parsed) {
    // Better a visible failure the commissioner can retry than a grade
    // nobody chose appearing under his name in front of the league.
    throw new Error(
      "Clams AI replied in a format I couldn't read. Try sealing that team again."
    );
  }

  return {
    grade: parsed.grade,
    comment: parsed.comment,
    model: MODEL,
    exampleCount: prompt.exampleCount,
  };
}

/** How many hand-written grades Clams AI has to learn from. */
export function corpusSize(): number {
  return CORPUS.length;
}

/** Whether he has written down any opinions of his own yet. */
export function hasStatedViews(): boolean {
  return hasContent(CONTEXT.philosophy) || hasContent(CONTEXT.players);
}
