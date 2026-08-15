// Letter grades, in the order they should appear in a dropdown - best
// first, the way Yahoo lists them.
export const GRADES = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
] as const;

export type Grade = (typeof GRADES)[number];

export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

/**
 * Who assigned a grade. Only the commissioner does today; the schema keeps
 * them separate so a generated grade can sit alongside rather than
 * overwrite one, which is the point of the "AI Jon Frye" idea.
 */
export type GradeSource = "commissioner" | "ai";

// Colours run green through red so a board of grades reads at a glance.
export function gradeColor(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return "bg-green-100 text-green-900 border-green-400 dark:bg-green-950 dark:text-green-200 dark:border-green-700";
    case "B":
      return "bg-lime-100 text-lime-900 border-lime-400 dark:bg-lime-950 dark:text-lime-200 dark:border-lime-700";
    case "C":
      return "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700";
    case "D":
      return "bg-orange-100 text-orange-900 border-orange-400 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700";
    default:
      return "bg-red-100 text-red-900 border-red-400 dark:bg-red-950 dark:text-red-200 dark:border-red-700";
  }
}
