import pytest
from pydantic import ValidationError

from roleready.demo import DEMO_JOB, DEMO_RESUME, demo_analysis, demo_revision
from roleready.errors import GenerationError, InputError
from roleready.models import Analysis, Revision, match_score
from roleready.validation import (
    MAX_JOB_CHARS,
    MAX_RESUME_CHARS,
    normalize,
    quote_in,
    validate_grounding,
    validate_inputs,
    validate_rewrite,
)


def test_demo_score_and_grounding(sample_analysis):
    assert match_score(sample_analysis) == 75
    assert validate_grounding(sample_analysis, DEMO_RESUME, DEMO_JOB) is sample_analysis


@pytest.mark.parametrize(
    "resume,job",
    [("", DEMO_JOB), (DEMO_RESUME, "short"), ("x" * (MAX_RESUME_CHARS + 1), DEMO_JOB), (DEMO_RESUME, "x" * (MAX_JOB_CHARS + 1))],
)
def test_bad_inputs(resume, job):
    with pytest.raises(InputError):
        validate_inputs(resume, job)


def test_normalize_and_quote():
    assert normalize(" ＳＱＬ\x00\r\n ") == "SQL"
    assert quote_in("weekly sales", "weekly\n sales")
    assert not quote_in("", DEMO_RESUME)
    assert not quote_in("Led a team", DEMO_RESUME)


@pytest.mark.parametrize("mutation", ["job_quote", "resume_quote", "missing_evidence", "duplicate", "original", "number"])
def test_grounding_rejects_unsupported_results(sample_analysis, mutation):
    result = sample_analysis.model_copy(deep=True)
    if mutation == "job_quote":
        result.requirements[0].job_quote = "Kubernetes is mandatory."
    elif mutation == "resume_quote":
        result.requirements[0].resume_evidence = "Managed Kubernetes clusters."
    elif mutation == "missing_evidence":
        result.requirements[-1].resume_evidence = "Python"
    elif mutation == "duplicate":
        result.requirements.append(result.requirements[0])
    elif mutation == "original":
        result.bullet_rewrites[0].original = "Led a team of engineers."
    elif mutation == "number":
        result.bullet_rewrites[0].rewritten = "Cleaned 900 survey responses with Python."
    with pytest.raises(GenerationError):
        validate_grounding(result, DEMO_RESUME, DEMO_JOB)


@pytest.mark.parametrize(
    "rewritten",
    ["Cleaned 500 responses and improved quality by 40%.", "Saved $500 with a Python script.", "Cleaned 500% of survey responses."],
)
def test_rewrite_numeric_units(rewritten):
    revision = Revision(original="Built a Python script to clean 500 survey responses.", rewritten=rewritten, rationale="Test")
    with pytest.raises(GenerationError):
        validate_rewrite(revision, DEMO_RESUME)


@pytest.mark.parametrize("style", ["Concise", "Action-focused"])
def test_all_demo_revisions_grounded(sample_analysis, style):
    for bullet in sample_analysis.bullet_rewrites:
        validate_rewrite(demo_revision(bullet.original, style), DEMO_RESUME)


def test_demo_never_pretends_to_analyze_custom_inputs():
    with pytest.raises(InputError, match="fixed fictional sample"):
        demo_analysis(DEMO_RESUME + "\nNew skill: Snowflake", DEMO_JOB)


def test_schema_rejects_extra_fields_and_empty_analysis(sample_analysis):
    data = sample_analysis.model_dump()
    data["hiring_probability"] = 99
    with pytest.raises(ValidationError):
        Analysis.model_validate(data)
    data.pop("hiring_probability")
    data["requirements"] = []
    with pytest.raises(ValidationError):
        Analysis.model_validate(data)


def test_score_extremes(sample_analysis):
    a = sample_analysis.model_copy(deep=True)
    for item in a.requirements:
        item.status = "matched"
    assert match_score(a) == 100
    for item in a.requirements:
        item.status = "missing"
    assert match_score(a) == 0
