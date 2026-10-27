import { wordChanges } from "@/lib/ux";
export default function WordDiff({
  before,
  after,
  label = "Wording changes",
}: {
  before: string;
  after: string;
  label?: string;
}) {
  if (before === after)
    return <p className="helper">The wording is unchanged.</p>;
  return (
    <section className="word-comparison" aria-label={label}>
      <p className="diff-legend">
        <span>
          <del>Removed</del>
        </span>
        <span>
          <ins>Added</ins>
        </span>
      </p>
      <p className="diff-text">
        {wordChanges(before, after).map((part, i) =>
          part.type === "same" ? (
            <span key={i}>{part.text}</span>
          ) : part.type === "added" ? (
            <ins key={i}>
              <span className="sr-only">Added: </span>
              {part.text}
            </ins>
          ) : (
            <del key={i}>
              <span className="sr-only">Removed: </span>
              {part.text}
            </del>
          ),
        )}
      </p>
    </section>
  );
}
