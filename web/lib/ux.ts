import type { Analysis, Report, Revision } from "./schema";

export type WordChange = { type: "same" | "added" | "removed"; text: string };
/** Longest common subsequence preserves word order; React renders every token as text. */
export function wordChanges(before: string, after: string): WordChange[] {
  const a = before.match(/\S+\s*/g) ?? [],
    b = after.match(/\S+\s*/g) ?? [];
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i].trim() === b[j].trim()
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  const result: WordChange[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].trim() === b[j].trim()) {
      result.push({ type: "same", text: b[j++] });
      i++;
    } else if (
      i < a.length &&
      (j === b.length || table[i + 1][j] >= table[i][j + 1])
    )
      result.push({ type: "removed", text: a[i++] });
    else result.push({ type: "added", text: b[j++] });
  }
  return result;
}
export function isKnownDraft(
  report: Report,
  revision: Revision,
  seen: Revision[] = [],
) {
  return [
    ...report.analysis.bullet_rewrites,
    ...report.revisions,
    ...seen,
  ].some(
    (r) =>
      r.original === revision.original && r.rewritten === revision.rewritten,
  );
}
const ignored = new Set(
  "the and with your from have only true real work experience resume relevant details example available findings bullet bullets near keep clarify prioritize describe using used prepare actual add not otherwise".split(
    " ",
  ),
);
function terms(value: string) {
  return new Set(
    (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((t) => t.length >= 3 && !ignored.has(t))
      .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}
/** These are text-overlap shortcuts, not new model assessments or inferred facts. */
export function actionTargets(action: string, analysis: Analysis) {
  const words = terms(action);
  const score = (value: string) =>
    [...terms(value)].filter((t) => words.has(t)).length;
  const requirements = analysis.requirements
    .map((r, index) => ({ index, score: score(r.requirement) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((t) => t.index);
  const bullets = analysis.bullet_rewrites
    .map((b, index) => ({ index, score: score(b.original) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((t) => t.index);
  return { requirements, bullets };
}
