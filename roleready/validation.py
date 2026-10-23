import re
import unicodedata

from .errors import GenerationError, InputError
from .models import Analysis, BulletRewrite, Revision

MAX_RESUME_CHARS = 24000
MAX_JOB_CHARS = 18000
MAX_FEEDBACK_CHARS = 1500


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\x00", "")
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").splitlines()).strip()


def validate_text(text: str, label: str, limit: int, minimum: int = 80) -> str:
    if len(text) > limit:
        raise InputError(f"{label} must be at most {limit:,} characters. Shorten it and try again.")
    text = normalize(text)
    if len(text) < minimum or len(re.findall(r"\w+", text)) < min(12, minimum // 3):
        raise InputError(f"{label} needs more detail (at least {minimum} characters).")
    return text


def validate_inputs(resume: str, job: str) -> tuple[str, str]:
    return (
        validate_text(resume, "Resume", MAX_RESUME_CHARS),
        validate_text(job, "Job description", MAX_JOB_CHARS),
    )


def quote_in(quote: str, source: str) -> bool:
    """Permit whitespace changes, but not invented or paraphrased citations."""

    def compact(s):
        return " ".join(normalize(s).split())

    return bool(quote.strip()) and compact(quote) in compact(source)


def validate_rewrite(rewrite: BulletRewrite | Revision, resume: str) -> None:
    if not quote_in(rewrite.original, resume):
        raise GenerationError("A suggested bullet did not match the resume. No draft was accepted; try again.")

    # Catch invented or altered numeric claims, including percent/currency units.
    def numbers(s):
        return set(re.findall(r"(?<!\w)[$€£]?\d[\d,]*(?:\.\d+)?%?", s))

    if not numbers(rewrite.rewritten) <= numbers(rewrite.original):
        raise GenerationError("A draft introduced an unsupported number. No draft was accepted; try again.")


def validate_grounding(analysis: Analysis, resume: str, job: str) -> Analysis:
    seen = set()
    for item in analysis.requirements:
        key = " ".join(item.requirement.casefold().split())
        if key in seen:
            raise GenerationError("The analysis repeated a requirement. Please try again.")
        seen.add(key)
        if not quote_in(item.job_quote, job):
            raise GenerationError("A job requirement lacked a valid source quote. Please try again.")
        if item.status == "missing":
            if item.resume_evidence.strip():
                raise GenerationError("The analysis contained inconsistent evidence. Please try again.")
        elif not quote_in(item.resume_evidence, resume):
            raise GenerationError("A match lacked a valid resume quote. Please try again.")
    for rewrite in analysis.bullet_rewrites:
        validate_rewrite(rewrite, resume)
    return analysis
