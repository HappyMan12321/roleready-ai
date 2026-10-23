from pathlib import Path

from streamlit.testing.v1 import AppTest

from roleready.demo import DEMO_RESUME
from roleready.models import Revision
from roleready.errors import GenerationError

APP = Path(__file__).resolve().parents[1] / "app.py"


def app():
    return AppTest.from_file(str(APP), default_timeout=20).run()


def test_demo_end_to_end_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    at = app()
    assert not at.exception
    at.button(key="load_demo").click().run()
    assert at.text_area(key="resume_text").value == DEMO_RESUME
    at.button(key="analyze").click().run()
    assert not at.exception
    assert at.metric[0].value == "75/100"
    at.button(key="refine").click().run()
    assert not at.exception
    assert len(at.session_state["report"]["revisions"]) == 1
    at.text_area(key="resume_text").set_value(DEMO_RESUME + "\nEdited.").run()
    assert "report" not in at.session_state
    assert not at.exception


def test_demo_rejects_custom_input_and_empty_input():
    at = app()
    at.button(key="analyze").click().run()
    assert any("needs more detail" in e.value for e in at.error)
    at.button(key="load_demo").click().run()
    at.text_area(key="resume_text").set_value(DEMO_RESUME + "\nEdited.").run()
    at.button(key="analyze").click().run()
    assert any("fixed fictional sample" in e.value for e in at.error)
    assert "report" not in at.session_state


def test_live_requires_consent_before_api(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Must not create an API client without consent")

    monkeypatch.setattr("roleready.service.OpenAIReviewer.__init__", forbidden)
    at = app()
    at.button(key="load_demo").click().run()
    at.radio(key="mode").set_value("Live").run()
    at.button(key="analyze").click().run()
    assert not at.exception
    assert any("sharing checkbox" in w.value for w in at.warning)
    assert "report" not in at.session_state


def test_clear_session_removes_entered_key_and_report():
    at = app()
    at.button(key="load_demo").click().run()
    at.button(key="analyze").click().run()
    at.radio(key="mode").set_value("Live").run()
    at.text_input(key="api_key").set_value("fake-test-key").run()
    at.button(key="clear").click().run()
    assert not at.exception
    assert at.text_area(key="resume_text").value == ""
    assert at.text_area(key="job_text").value == ""
    assert "report" not in at.session_state
    assert "api_key" not in at.session_state


def test_demo_voice_and_upload_fingerprint_reset():
    at = app()
    at.session_state["file_hash"] = "old-upload-fingerprint"
    at.run()
    assert "file_hash" not in at.session_state
    at.radio(key="mode").set_value("Live").run()
    at.selectbox(key="persona").select("Technical hiring reviewer").run()
    at.radio(key="mode").set_value("Demo").run()
    assert at.selectbox(key="persona").value == "Supportive career coach"
    assert not at.exception


def test_refinement_limit():
    at = app()
    at.button(key="load_demo").click().run()
    at.button(key="analyze").click().run()
    for _ in range(5):
        at.button(key="refine").click().run()
    assert len(at.session_state["report"]["revisions"]) == 5
    assert at.button(key="refine").disabled
    assert not at.exception


def test_live_ui_refinement_and_revoke_consent(monkeypatch, sample_analysis):
    calls = []

    def analyze(self, **kwargs):
        calls.append(("analyze", kwargs))
        return sample_analysis

    def refine(self, **kwargs):
        calls.append(("refine", kwargs))
        return Revision(
            original=kwargs["original"],
            rewritten="Cleaned 500 survey responses using Python.",
            rationale="Test fixture, not a live result.",
        )

    monkeypatch.setattr("roleready.service.OpenAIReviewer.analyze", analyze)
    monkeypatch.setattr("roleready.service.OpenAIReviewer.refine", refine)
    at = app()
    at.button(key="load_demo").click().run()
    at.radio(key="mode").set_value("Live").run()
    at.text_input(key="api_key").set_value("fake-test-key").run()
    at.checkbox(key="consent").check().run()
    at.button(key="analyze").click().run()
    assert not at.exception

    assert at.session_state["report"]["source"] == "OpenAI API"
    at.text_area(key="feedback").set_value("Make this more concise.").run()
    at.button(key="refine").click().run()
    at.button(key="refine").click().run()
    assert calls[-1][1]["draft"] == "Cleaned 500 survey responses using Python."
    assert len(at.session_state["report"]["revisions"]) == 2
    at.checkbox(key="consent").uncheck().run()
    at.button(key="refine").click().run()
    assert len(calls) == 3
    assert any("sharing checkbox" in w.value for w in at.warning)
    at.text_input(key="model_id").set_value("another-model").run()
    assert "report" not in at.session_state
    assert not at.exception


def test_live_no_source_bullets_and_failed_rerun(monkeypatch, sample_analysis):
    result = sample_analysis.model_copy(deep=True)
    result.bullet_rewrites = []

    def analyze(self, **kwargs):
        return result

    monkeypatch.setattr("roleready.service.OpenAIReviewer.analyze", analyze)
    at = app()
    at.button(key="load_demo").click().run()
    at.radio(key="mode").set_value("Live").run()
    at.text_input(key="api_key").set_value("fake-test-key").run()
    at.checkbox(key="consent").check().run()
    at.button(key="analyze").click().run()
    assert not at.exception
    assert any("No suitable experience" in i.value for i in at.info)
    assert "report" in at.session_state

    def failed(self, **kwargs):
        raise GenerationError("Simulated API failure")

    monkeypatch.setattr("roleready.service.OpenAIReviewer.analyze", failed)
    at.button(key="analyze").click().run()
    assert "report" not in at.session_state
    assert at.text_area(key="resume_text").value == DEMO_RESUME
    assert any("Simulated API failure" in e.value for e in at.error)
    assert not at.exception
