import json

from roleready.report import input_fingerprint, make_report, report_text


def test_exports_are_labeled_and_include_history(sample_analysis):
    report = make_report(sample_analysis, "Demo", "demo", "Supportive career coach")
    report["revisions"].append(sample_analysis.bullet_rewrites[0].model_dump())
    text = report_text(report)
    assert "Human-authored fictional demo" in text
    assert "REFINEMENT HISTORY" in text
    assert "75/100" in text
    assert "not an ATS score" in text
    assert "test-key" not in json.dumps(report)
    assert report["model"] is None


def test_live_provenance_and_fingerprint(sample_analysis):
    report = make_report(sample_analysis, "Live", "gpt-4o-mini", "Direct resume editor")
    assert report["source"] == "OpenAI API"
    assert report["model"] == "gpt-4o-mini"
    fp = input_fingerprint("resume", "job", "Demo", "coach", "demo")
    assert fp != input_fingerprint("edited resume", "job", "Demo", "coach", "demo")
    assert fp != input_fingerprint("resume", "job", "Live", "coach", "demo")
