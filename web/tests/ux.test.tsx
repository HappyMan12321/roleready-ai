// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WordDiff from "../components/word-diff";
import { wordChanges, actionTargets, isKnownDraft } from "../lib/ux";
import { AnalysisSchema, Report } from "../lib/schema";
import demo from "../lib/demo.json";
afterEach(cleanup);
const analysis = AnalysisSchema.parse(demo.analysis);
function report(): Report {
  return {
    id: "ux",
    created: "2026-10-26T00:00:00Z",
    source: "demo",
    materials: {
      resume: demo.resume,
      job: demo.job,
      role: "Example",
      persona: "Supportive career coach",
    },
    analysis,
    revisions: [],
    active: {},
    previewCount: 0,
  };
}
describe("readable and safe wording comparisons", () => {
  it("reconstructs both source texts from a word-level comparison", () => {
    const before = "Built a Python script to clean 500 survey responses.",
      after = "Cleaned 500 survey responses using Python.";
    const parts = wordChanges(before, after);
    expect(
      parts
        .filter((p) => p.type !== "added")
        .map((p) => p.text)
        .join(""),
    ).toBe(before);
    expect(
      parts
        .filter((p) => p.type !== "removed")
        .map((p) => p.text)
        .join(""),
    ).toBe(after);
    expect(parts.some((p) => p.type === "same")).toBe(true);
  });
  it("handles empty or identical drafts without fabricated changes", () => {
    expect(wordChanges("", "")).toEqual([]);
    expect(wordChanges("SQL", "SQL")).toEqual([{ type: "same", text: "SQL" }]);
    render(<WordDiff before="SQL" after="SQL" />);
    expect(screen.getByText("The wording is unchanged.")).toBeTruthy();
  });
  it("renders document markup as inert text inside additions/removals", () => {
    const { container } = render(
      <WordDiff
        before="Used SQL."
        after={"Used <img src=x onerror=alert(1)> SQL."}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("ins")).not.toBeNull();
    expect(screen.getByLabelText("Wording changes")).toBeTruthy();
  });
});
describe("useful action shortcuts and preview allowances", () => {
  it("links SQL/Python advice to matching evidence and real bullets", () => {
    const targets = actionTargets(analysis.action_plan[0], analysis);
    expect(targets.requirements).toEqual([0, 1]);
    expect(targets.bullets).toContain(0);
    expect(targets.bullets).toContain(2);
  });
  it("links singular warehouse advice to the plural qualification", () => {
    expect(
      actionTargets(analysis.action_plan[2], analysis).requirements,
    ).toEqual([5, 6]);
  });
  it("does not invent a specific target for generic advice", () => {
    expect(actionTargets("Keep your resume truthful.", analysis)).toEqual({
      requirements: [],
      bullets: [],
    });
  });
  it("recognizes rejected previews so repeated output is not charged twice", () => {
    const r = report();
    const revision = {
      ...analysis.bullet_rewrites[0],
      rewritten: "Cleaned 500 survey responses using Python.",
    };
    expect(isKnownDraft(r, revision)).toBe(false);
    expect(isKnownDraft(r, revision, [revision])).toBe(true);
    expect(isKnownDraft(r, analysis.bullet_rewrites[0])).toBe(true);
  });
});
