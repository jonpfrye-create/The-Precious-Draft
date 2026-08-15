import { GRADES, isGrade } from "../draft/grades";
import {
  averageCommentWords,
  examplesFor,
  gradeDistribution,
  hasContent,
  sectionBody,
  EMPTY_CONTEXT,
  type CorpusEntry,
  type VoiceContext,
} from "./corpus";

/**
 * Builds the prompt that makes Clams AI sound like the commissioner
 * rather than like a fantasy football website.
 *
 * The division of labour here is deliberate and worth keeping: these
 * instructions cover format and calibration only. Not one line of them
 * describes how the commissioner writes. Voice comes entirely from the
 * examples, because any adjective chosen here ("wry", "blunt") would be a
 * guess at someone's personality, and the model would then perform that
 * guess instead of the person. Same reason describeReport refuses to call
 * anything a reach.
 */

export interface GradePromptInput {
  /** The team being graded, already described by describeReport. */
  targetRoster: string;
  /** Identifies the target so its own grade can be excluded. */
  targetKey: string;
  corpus: readonly CorpusEntry[];
  /** His stated views. Optional - absent means market consensus only. */
  context?: VoiceContext;
}

export interface GradePrompt {
  system: string;
  user: string;
  /** How many examples survived the leave-one-out filter. */
  exampleCount: number;
}

export function buildGradePrompt(input: GradePromptInput): GradePrompt {
  const examples = examplesFor(input.targetKey, input.corpus);
  const context = input.context ?? EMPTY_CONTEXT;

  const distribution = gradeDistribution(examples);
  const targetWords = averageCommentWords(examples);

  const hasPhilosophy = hasContent(context.philosophy);
  const hasPlayerViews = hasContent(context.players);

  const systemParts: string[] = [
    "You are writing fantasy football draft grades in the voice of one specific person: the commissioner of this league.",
    "",
    "You will be shown grades he has written himself, each with the roster it was about. Study them for how he judges and how he writes, then grade a new team the way he would have. You are imitating one person's taste, not producing analysis.",
    "",
    `Answer with a letter grade from this scale: ${GRADES.join(", ")}.`,
    "",
    "Rules:",
    `- Write roughly ${targetWords} words. His comments are short. A long one is wrong even if it is good.`,
    hasPhilosophy || hasPlayerViews
      ? "- Every factual claim must come from the roster you are given, or from his stated views below. The roster states each pick's ADP and how far off it the pick was. Do not compute anything yourself and do not invent injuries, depth charts, or news."
      : "- Every factual claim must come from the roster you are given. It states each pick's ADP and how far off it the pick was. Do not compute anything yourself and do not invent injuries, depth charts, or news.",
    "- Do not hedge or balance. If the examples are opinionated, be opinionated.",
    "- Do not use analyst filler: no \"solid value\", no \"nice upside\", no \"time will tell\".",
    "- Grade the draft in front of you, not the average draft.",
  ];

  if (distribution.length > 0) {
    systemParts.push(
      "",
      "His grades so far have been distributed like this:",
      distribution.map((d) => `  ${d.grade}: ${d.count}`).join("\n"),
      "Match this spread. Do not drift upward into praise for everyone - that is the single most common way this goes wrong."
    );
  }

  if (hasPhilosophy) {
    systemParts.push(
      "",
      "HIS VIEWS ON ROSTER CONSTRUCTION, in his own words:",
      sectionBody(context.philosophy),
      "",
      "These are his opinions, not neutral analysis. Apply them. Where they disagree with ADP, side with him - ADP describes what everyone else did, and he is not everyone else."
    );
  }

  if (hasPlayerViews) {
    systemParts.push(
      "",
      "HIS VIEWS ON SPECIFIC PLAYERS, in his own words:",
      sectionBody(context.players),
      "",
      "Use these only for the players actually named. Do not infer what he thinks of a player who isn't on the list - guessing his opinion and then stating it in his voice is the one thing that would make this embarrassing rather than uncanny.",
      "",
      "A player he wouldn't take at a price is not a player he thinks is bad. The objection is to what the pick cost, so criticise the price and not the man - he will happily call a receiving corps great while saying it was paid for too early, and flattening that into \"receivers I don't trust\" states a harsher view than he holds."
    );
  }

  systemParts.push(
    "",
    "Reply in exactly this format and nothing else:",
    "GRADE: <letter>",
    "COMMENT: <your comment>"
  );

  const userParts: string[] = [];

  if (examples.length > 0) {
    userParts.push(
      `Here are ${examples.length} ${examples.length === 1 ? "grade" : "grades"} he wrote, with the rosters they were about.`,
      ""
    );
    for (const example of examples) {
      userParts.push(
        "--- ROSTER ---",
        example.roster,
        "",
        `HIS GRADE: ${example.grade}`,
        `HIS COMMENT: ${example.comment}`,
        ""
      );
    }
  } else {
    // Being explicit beats letting the model assume it has seen examples
    // it hasn't - it would otherwise invent a house style and commit to it.
    userParts.push(
      "You have no examples of his writing to work from this time. Grade plainly and briefly, and do not adopt a persona.",
      ""
    );
  }

  userParts.push(
    "Now grade this team, which he has not graded yet.",
    "",
    "--- ROSTER ---",
    input.targetRoster
  );

  return {
    system: systemParts.join("\n"),
    user: userParts.join("\n"),
    exampleCount: examples.length,
  };
}

export interface ParsedGrade {
  grade: string;
  comment: string;
}

/**
 * Reads the model's reply back into a grade and a comment.
 *
 * Deliberately forgiving about surroundings (markdown fences, a stray
 * preamble) and strict about the grade itself: an unrecognised letter is
 * an error, never a default. Silently storing "B" because the model wrote
 * something unparseable would put a grade the machine never chose in front
 * of the whole league.
 */
export function parseGradeResponse(text: string): ParsedGrade | null {
  const gradeMatch = text.match(/GRADE:\s*([A-F][+-]?)/i);
  if (!gradeMatch) return null;

  const grade = gradeMatch[1].toUpperCase();
  if (!isGrade(grade)) return null;

  const commentMatch = text.match(/COMMENT:\s*([\s\S]+)/i);
  const comment = commentMatch
    ? commentMatch[1].trim().replace(/^```|```$/g, "").trim()
    : "";
  if (!comment) return null;

  return { grade, comment };
}
