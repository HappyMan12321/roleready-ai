"""Run from this folder: python -m streamlit run app.py"""

import json
import hashlib
import os
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

from roleready.demo import DEMO_JOB, DEMO_RESUME, demo_analysis, demo_revision
from roleready.errors import RoleReadyError
from roleready.extraction import extract_resume
from roleready.models import Analysis
from roleready.prompts import PERSONAS
from roleready.report import input_fingerprint, make_report, report_text
from roleready.service import DEFAULT_MODEL, OpenAIReviewer
from roleready.validation import MAX_JOB_CHARS, MAX_RESUME_CHARS, validate_inputs

load_dotenv(Path(__file__).parent / ".env", override=False)
st.set_page_config(page_title="RoleReady AI · Make your experience count", page_icon="↗", layout="wide")


def clear_session():
    for key in list(st.session_state):
        del st.session_state[key]


def load_demo():
    st.session_state["resume_text"] = DEMO_RESUME
    st.session_state["job_text"] = DEMO_JOB
    st.session_state["input_method"] = "Paste text"
    for key in ("report", "fingerprint", "feedback", "consent"):
        st.session_state.pop(key, None)


def run_live(operation, **kwargs):
    if not st.session_state.get("consent"):
        st.warning("Confirm the sharing checkbox before sending content to OpenAI.")
        return None
    reviewer = OpenAIReviewer(key, model)
    try:
        return getattr(reviewer, operation)(**kwargs)
    finally:
        reviewer.close()


def refinement_ui(analysis, report, mode, resume, job, persona):
    if not analysis.bullet_rewrites:
        st.info(
            "No suitable experience or project bullet was found to rewrite. Add a truthful source bullet to the resume and analyze again."
        )
        return
    st.subheader("03 · Refine a bullet")
    selected = st.selectbox(
        "Choose a draft", range(len(analysis.bullet_rewrites)), format_func=lambda i: f"Draft {i + 1}", key="selected_bullet"
    )
    bullet = analysis.bullet_rewrites[selected]
    history = report["revisions"]
    latest = next((r["rewritten"] for r in reversed(history) if r["original"] == bullet.original), bullet.rewritten)
    st.caption("CURRENT DRAFT")
    st.text(latest)
    if mode == "Demo":
        style = st.selectbox("Demo refinement style", ["Concise", "Action-focused"], key="demo_style")
        st.caption("Demo refinement uses authored variants. Live mode accepts your own style feedback.")
    else:
        feedback = st.text_area(
            "Style feedback",
            key="feedback",
            max_chars=1500,
            placeholder="For example: Make it shorter and emphasize the action. New facts must be added to the resume, then analyzed again.",
        )
    if st.button("Refine selected bullet", key="refine", disabled=len(history) >= 5):
        try:
            with st.spinner("Refining the wording…"):
                revision = (
                    demo_revision(bullet.original, style)
                    if mode == "Demo"
                    else run_live(
                        "refine", resume=resume, job=job, persona=persona, original=bullet.original, draft=latest, feedback=feedback
                    )
                )
            if revision is not None:
                history.append(revision.model_dump())
                st.rerun()
        except RoleReadyError as error:
            st.error(str(error))
        except Exception:
            st.error("The refinement could not be completed. The current draft was kept.")
    st.caption(f"{len(history)}/5 refinements in this report. Re-analyze to start a new review.")
    if history:
        with st.expander("Refinement history", expanded=True):
            for i, revision in enumerate(history, 1):
                st.write(f"**Version {i}**")
                st.text(revision["rewritten"])
                st.caption(revision["rationale"])


for field in ("resume_text", "job_text"):
    st.session_state.setdefault(field, "")

with st.sidebar:
    st.markdown("### ↗ RoleReady AI")
    st.caption("Your experience. A clearer story.")
    mode = st.radio("Workspace mode", ["Demo", "Live"], key="mode", horizontal=True)
    if mode == "Demo":
        st.info("No key needed. Explore a fixed, fictional example with authored results.")
        key = ""
        model = "demo"
    else:
        key_input = st.text_input("OpenAI API key (optional if set in .env)", type="password", key="api_key")
        key = key_input.strip() or os.getenv("OPENAI_API_KEY", "")
        model = st.text_input("OpenAI model", value=os.getenv("OPENAI_MODEL", DEFAULT_MODEL), key="model_id")
        st.caption("Requests use your API account and may incur charges. Choose a model that supports Structured Outputs.")
    if mode == "Demo":
        st.session_state["persona"] = next(iter(PERSONAS))
    persona = st.selectbox("Coaching voice", list(PERSONAS), key="persona", disabled=mode == "Demo")
    if mode == "Demo":
        st.caption("Demo uses the supportive coach sample. Live mode applies your selected voice.")
    st.divider()
    st.button("Load demo data", key="load_demo", on_click=load_demo, width="stretch")
    st.button("Clear session", key="clear", on_click=clear_session, width="stretch")
    st.caption("Clear session removes this app's in-memory drafts, uploads, and entered key. A key configured in .env stays configured.")
    with st.expander("Privacy & limits"):
        st.write(
            "Remove contact details and sensitive information before use. Live mode sends your resume, job description, and refinement context to OpenAI after your confirmation."
        )
        st.write(
            "This app does not write uploads or reports to disk, cache user content, or log prompts. Downloads are saved only when you request them. OpenAI may retain data under its API policies; store=False is not a zero-retention guarantee."
        )
        st.write(
            "Local MVP: no accounts or production security isolation. Document size checks reduce risk but are not a sandbox. Only open documents you trust."
        )

st.caption("CAREER TOOLKIT / RESUME ALIGNMENT")
st.title("Make your experience count.")
st.write("Find the evidence a role is asking for. Turn the experience you already have into clearer, more relevant bullets.")
st.caption("01  Add your materials     ·     02  Review the match     ·     03  Refine your story")

left, right = st.columns(2, gap="large")
upload_error = False
with left:
    st.subheader("01 · Your resume")
    method = st.radio("Resume input", ["Paste text", "Upload PDF / DOCX"], key="input_method", horizontal=True)
    if method == "Upload PDF / DOCX":
        upload = st.file_uploader("Upload resume · up to 5 MB", type=["pdf", "docx"], key="upload")
        if upload is not None:
            try:
                # Reparse locally on rerun; no cross-session upload cache.
                extracted = extract_resume(upload.getvalue(), upload.name)
                file_hash = hashlib.sha256(upload.getvalue()).hexdigest()
                if st.session_state.get("file_hash") != file_hash:
                    st.session_state["resume_text"] = extracted
                    st.session_state["file_hash"] = file_hash
                st.caption("Review the extracted text below. You can correct formatting before analysis.")
            except RoleReadyError as error:
                st.error(str(error))
                upload_error = True
        else:
            st.info("Choose a file, or switch to Paste text.")
            upload_error = True
    else:
        st.session_state.pop("file_hash", None)
    resume = st.text_area(
        "Resume text · review before sending",
        key="resume_text",
        height=300,
        max_chars=MAX_RESUME_CHARS,
        placeholder="Paste your experience, projects, skills, and education here…",
    )
    st.caption(f"{len(resume):,} / {MAX_RESUME_CHARS:,} characters · Text PDFs and DOCX only; scans need OCR.")
with right:
    st.subheader("02 · The opportunity")
    job = st.text_area(
        "Job description",
        key="job_text",
        height=380,
        max_chars=MAX_JOB_CHARS,
        placeholder="Paste the responsibilities, required skills, and preferred qualifications…",
    )
    st.caption(f"{len(job):,} / {MAX_JOB_CHARS:,} characters · Include the full requirements for a useful comparison.")

if mode == "Live":
    st.checkbox("I agree to send these materials and any refinement context to OpenAI for this review.", key="consent")
else:
    st.caption("DEMO · Fictional inputs and human-authored outputs. No OpenAI request is made. Load the sample to explore.")

fingerprint = input_fingerprint(resume, job, mode, persona, model)
if "report" in st.session_state and (st.session_state.get("fingerprint") != fingerprint or upload_error):
    st.session_state.pop("report", None)
    st.session_state.pop("fingerprint", None)
    st.info("Your materials or settings changed. Analyze again to create an up-to-date report.")

if st.button("Analyze job match" if mode == "Live" else "Explore demo report", type="primary", key="analyze", disabled=upload_error):
    st.session_state.pop("report", None)
    st.session_state.pop("fingerprint", None)
    try:
        resume_clean, job_clean = validate_inputs(resume, job)
        with st.spinner("Reviewing requirements and checking source evidence…"):
            result = (
                demo_analysis(resume_clean, job_clean)
                if mode == "Demo"
                else run_live("analyze", resume=resume_clean, job=job_clean, persona=persona)
            )
        if result is not None:
            st.session_state["report"] = make_report(result, mode, model, persona)
            st.session_state["fingerprint"] = fingerprint
            st.session_state.pop("feedback", None)
            st.session_state.pop("selected_bullet", None)
    except RoleReadyError as error:
        st.error(str(error))
    except Exception:
        st.error("The review could not be completed. Your inputs remain available; please try again.")

if "report" not in st.session_state:
    st.divider()
    st.subheader("A stronger application starts with the facts.")
    a, b, c = st.columns(3)
    a.write("**Evidence, first**\n\nEvery match points back to your resume and the role's requirements.")
    b.write("**Clearer bullets**\n\nImprove how you describe your work while keeping its factual scope.")
    c.write("**A focused next step**\n\nSee what to clarify, what to practice, and what is not yet evidenced.")
else:
    report = st.session_state["report"]
    analysis = Analysis.model_validate(report["analysis"])
    st.divider()
    st.subheader("Your role alignment")
    st.caption(f"Source: {report['source']} · Persona: {report['persona']}")
    if mode == "Demo":
        st.info("Illustrative demo report — these results were authored for the fictional sample, not generated by OpenAI.")
    score_col, summary_col = st.columns([1, 3])
    score_col.metric("Evidence alignment", f"{report['alignment_score']}/100")
    score_col.progress(report["alignment_score"] / 100)
    summary_col.write(analysis.summary)
    st.caption(
        "Heuristic only. This is not an ATS score or hiring probability; the model's interpretation of requirements affects the result."
    )
    with st.expander("How the score works"):
        st.write(report["score_method"])
    tabs = st.tabs(["Match evidence", "Bullet studio", "Action plan", "Export & limits"])
    with tabs[0]:
        st.write("Missing means not evidenced in this resume. It does not mean you lack the skill.")
        st.dataframe(
            [
                {
                    "Requirement": r.requirement,
                    "Priority": r.importance.title(),
                    "Match": r.status.title(),
                    "Resume evidence": r.resume_evidence or "Not evidenced",
                    "Next step": r.next_step,
                }
                for r in analysis.requirements
            ],
            width="stretch",
            hide_index=True,
        )
        for i, r in enumerate(analysis.requirements, 1):
            with st.expander(f"{i}. {r.requirement} · {r.status.title()}"):
                st.write("**Job source**")
                st.text(r.job_quote)
                st.write("**Resume source**")
                st.text(r.resume_evidence or "Not evidenced")
                st.write(r.explanation)
                st.write(r.next_step)
    with tabs[1]:
        st.warning(
            "Review every draft before use. Quote and number checks cannot verify full factual meaning. Keep only claims you can support."
        )
        for i, bullet in enumerate(analysis.bullet_rewrites, 1):
            with st.container(border=True):
                st.write(f"**Draft {i}**")
                before, after = st.columns(2)
                before.caption("ORIGINAL")
                before.text(bullet.original)
                after.caption("SUGGESTED")
                after.text(bullet.rewritten)
                st.caption(bullet.rationale)
        refinement_ui(analysis, report, mode, resume, job, persona)
    with tabs[2]:
        for title, items in [
            ("Your next moves", analysis.action_plan),
            ("Resume readability & ATS tips", analysis.ats_tips),
            ("Practice for the conversation", analysis.interview_questions),
        ]:
            st.subheader(title)
            for i, item in enumerate(items, 1):
                st.write(f"{i}. {item}")
    with tabs[3]:
        st.write(
            "Download your review, including evidence and revision history. The full original resume is not included; quoted excerpts are included."
        )
        first, second = st.columns(2)
        first.download_button("Download text report", report_text(report), "roleready-review.txt", "text/plain", width="stretch")
        second.download_button(
            "Download JSON report",
            json.dumps(report, indent=2, ensure_ascii=False),
            "roleready-review.json",
            "application/json",
            width="stretch",
        )
        st.subheader("Read this with the report")
        for limitation in analysis.limitations:
            st.write("• " + limitation)
        st.write(
            "Suggestions are drafts, not verified achievements. The score does not predict hiring outcomes. Model interpretation and document extraction can be wrong."
        )

st.divider()
st.caption("ROLEREADY AI · Evidence-led career coaching · Built for applicants")
