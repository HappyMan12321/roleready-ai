"""Human-authored fictional fixture, never presented as a live model response."""

from pathlib import Path

from .errors import InputError
from .models import Analysis, Revision
from .validation import normalize, validate_grounding

ROOT = Path(__file__).resolve().parent.parent
DEMO_RESUME = (ROOT / "demo/resume.txt").read_text()
DEMO_JOB = (ROOT / "demo/job_description.txt").read_text()


def demo_analysis(resume: str, job: str) -> Analysis:
    if normalize(resume) != normalize(DEMO_RESUME) or normalize(job) != normalize(DEMO_JOB):
        raise InputError("Demo reports use the fixed fictional sample. Select 'Load demo data' or switch to Live mode for your own inputs.")
    rows = [
        (
            "SQL",
            "SQL experience is required to query sales data.",
            "required",
            "matched",
            "Used SQL to query sales data and summarize weekly sales trends.",
            "SQL querying is explicitly evidenced.",
            "Be ready to explain the queries and data checks you used.",
        ),
        (
            "Python data cleaning",
            "Python experience is required for data cleaning.",
            "required",
            "matched",
            "Built a Python script to clean 500 survey responses.",
            "A concrete Python cleaning project is included.",
            "Explain how missing values and duplicates were handled, if applicable.",
        ),
        (
            "Data visualization",
            "Data visualization experience is required; Tableau is preferred.",
            "required",
            "matched",
            "Built a Tableau dashboard to visualize monthly sales by region.",
            "The dashboard demonstrates visualization experience and the preferred tool.",
            "Prepare a walkthrough of the dashboard using non-confidential data.",
        ),
        (
            "Stakeholder communication",
            "Strong communication of findings to stakeholders is required.",
            "required",
            "partial",
            "Shared weekly findings with the marketing team.",
            "The resume supports communication, but does not describe its clarity or impact.",
            "If true, describe how the team used your findings. Do not invent an outcome.",
        ),
        (
            "Relevant degree",
            "A bachelor's degree in analytics or a related field is required.",
            "required",
            "matched",
            "B.S. Business Analytics, Example University | 2026",
            "The listed degree aligns with the requested field.",
            "Keep the degree title and completion date accurate.",
        ),
        (
            "A/B testing",
            "Experience designing and analyzing A/B tests.",
            "preferred",
            "missing",
            "",
            "A/B testing is not evidenced in the resume.",
            "If you have relevant coursework or a real project, add it; otherwise consider a practice project.",
        ),
        (
            "Cloud data warehouses",
            "Familiarity with cloud data warehouses such as Snowflake.",
            "preferred",
            "missing",
            "",
            "Cloud warehouse experience is not evidenced in the resume.",
            "Only add Snowflake if you have actually used it; consider introductory practice.",
        ),
    ]
    requirements = [
        dict(zip(("requirement", "job_quote", "importance", "status", "resume_evidence", "explanation", "next_step"), row)) for row in rows
    ]
    result = Analysis(
        summary="The sample resume shows relevant SQL, Python, Tableau, and analytics education. Stakeholder communication needs clearer evidence; A/B testing and cloud warehouses are not evidenced. This is a human-authored demonstration report.",
        requirements=requirements,
        bullet_rewrites=[
            {
                "original": "Built a Python script to clean 500 survey responses.",
                "rewritten": "Cleaned 500 survey responses with a Python script.",
                "rationale": "Leads with the task and preserves the provided tool and count.",
            },
            {
                "original": "Built a Tableau dashboard to visualize monthly sales by region.",
                "rewritten": "Visualized monthly sales by region in a Tableau dashboard.",
                "rationale": "Highlights the visualization purpose without adding an outcome.",
            },
            {
                "original": "Used SQL to query sales data and summarize weekly sales trends.",
                "rewritten": "Queried sales data with SQL to summarize weekly sales trends.",
                "rationale": "Uses a direct action verb while preserving the original scope.",
            },
        ],
        action_plan=[
            "Prioritize the SQL and Python bullets near the top of relevant experience.",
            "Clarify stakeholder communication with a real example, if available.",
            "Add A/B testing or warehouse experience only if you can support it with actual work.",
        ],
        ats_tips=[
            "Use standard headings such as Experience, Projects, and Education.",
            "Use relevant terms such as SQL and Python where already supported by experience.",
            "Check the extracted text before applying; complex layouts can lose reading order.",
        ],
        interview_questions=[
            "How did you clean the survey responses with Python?",
            "How did your Tableau dashboard help explain regional sales trends?",
            "How would you approach learning to design an A/B test?",
        ],
        limitations=[
            "This report is an authored fictional example, not an OpenAI API result.",
            "The alignment score is a heuristic, not an ATS score or a hiring prediction.",
            "Source matching and number checks cannot establish full semantic truth; review every draft.",
        ],
    )
    return validate_grounding(result, resume, job)


def demo_revision(original: str, style: str) -> Revision:
    options = {
        "Built a Python script to clean 500 survey responses.": {
            "Concise": "Cleaned 500 survey responses using Python.",
            "Action-focused": "Built a Python script that cleaned 500 survey responses.",
        },
        "Built a Tableau dashboard to visualize monthly sales by region.": {
            "Concise": "Visualized regional monthly sales in Tableau.",
            "Action-focused": "Built a Tableau dashboard showing monthly sales by region.",
        },
        "Used SQL to query sales data and summarize weekly sales trends.": {
            "Concise": "Summarized weekly sales trends using SQL queries.",
            "Action-focused": "Queried sales data using SQL and summarized weekly sales trends.",
        },
    }
    return Revision(
        original=original,
        rewritten=options[original][style],
        rationale="Authored demo variant; preserves the original facts and changes wording only.",
    )
