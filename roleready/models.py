from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Requirement(StrictModel):
    requirement: str = Field(min_length=1, max_length=200)
    job_quote: str = Field(min_length=1, max_length=700)
    importance: Literal["required", "preferred"]
    status: Literal["matched", "partial", "missing"]
    resume_evidence: str = Field(max_length=1000)
    explanation: str = Field(min_length=1, max_length=1000)
    next_step: str = Field(min_length=1, max_length=1000)


class BulletRewrite(StrictModel):
    original: str = Field(min_length=10, max_length=1500)
    rewritten: str = Field(min_length=10, max_length=1500)
    rationale: str = Field(min_length=1, max_length=700)


class Analysis(StrictModel):
    summary: str = Field(min_length=1, max_length=1800)
    requirements: list[Requirement] = Field(min_length=1, max_length=16)
    bullet_rewrites: list[BulletRewrite] = Field(max_length=5)
    action_plan: list[str] = Field(min_length=1, max_length=6)
    ats_tips: list[str] = Field(min_length=1, max_length=5)
    interview_questions: list[str] = Field(min_length=1, max_length=5)
    limitations: list[str] = Field(min_length=1, max_length=5)


class Revision(StrictModel):
    original: str = Field(min_length=10, max_length=1500)
    rewritten: str = Field(min_length=10, max_length=1500)
    rationale: str = Field(min_length=1, max_length=700)


def match_score(analysis: Analysis) -> int:
    """Transparent heuristic; never an ATS score or hiring probability."""
    weights = {"required": 2, "preferred": 1}
    credit = {"matched": 1, "partial": 0.5, "missing": 0}
    total = sum(weights[r.importance] for r in analysis.requirements)
    earned = sum(weights[r.importance] * credit[r.status] for r in analysis.requirements)
    return round(100 * earned / total)
