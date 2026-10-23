import hashlib
import json
from datetime import datetime, timezone

from .models import Analysis, match_score
from .prompts import PROMPT_VERSION


def input_fingerprint(resume: str, job: str, mode: str, persona: str, model: str) -> str:
    return hashlib.sha256(json.dumps([resume, job, mode, persona, model]).encode()).hexdigest()


def make_report(analysis: Analysis, mode: str, model: str, persona: str) -> dict:
    return {
        "app": "RoleReady AI",
        "report_version": "1.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "Human-authored fictional demo" if mode == "Demo" else "OpenAI API",
        "model": None if mode == "Demo" else model,
        "persona": persona,
        "prompt_version": PROMPT_VERSION,
        "alignment_score": match_score(analysis),
        "score_method": "Required weight 2; preferred weight 1; matched 1, partial 0.5, missing 0. Rounded weighted percentage. Not an ATS score or hiring probability.",
        "analysis": analysis.model_dump(),
        "revisions": [],
    }


def report_text(report: dict) -> str:
    a = Analysis.model_validate(report["analysis"])
    lines = [
        "ROLEREADY AI — RESUME REVIEW",
        f"Source: {report['source']}",
        f"Created (UTC): {report['created_at']}",
        f"Persona: {report['persona']}",
        f"Alignment: {report['alignment_score']}/100",
        report["score_method"],
        "",
        a.summary,
        "",
        "REQUIREMENTS",
    ]
    for r in a.requirements:
        lines.extend(
            [
                f"{r.requirement} [{r.importance}; {r.status}]",
                f"Job: {r.job_quote}",
                f"Resume: {r.resume_evidence or 'Not evidenced'}",
                r.explanation,
                f"Next: {r.next_step}",
                "",
            ]
        )
    lines.append("BULLET DRAFTS — VERIFY EVERY CLAIM BEFORE USE")
    for b in a.bullet_rewrites:
        lines.extend([f"Original: {b.original}", f"Draft: {b.rewritten}", b.rationale, ""])
    for heading, items in [
        ("ACTION PLAN", a.action_plan),
        ("ATS TIPS", a.ats_tips),
        ("INTERVIEW PRACTICE", a.interview_questions),
        ("LIMITATIONS", a.limitations),
    ]:
        lines.extend([heading, *[f"- {item}" for item in items], ""])
    if report["revisions"]:
        lines.append("REFINEMENT HISTORY")
        for revision in report["revisions"]:
            lines.extend([f"Original: {revision['original']}", f"Draft: {revision['rewritten']}", revision["rationale"], ""])
    lines.append("Automated checks verify source excerpts and numeric tokens, not full factual meaning. Human review is required.")
    return "\n".join(lines)
