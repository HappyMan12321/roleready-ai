# Local verification

Date: October 20, 2026. Environment: macOS arm64, Python 3.12.14.

## Completed checks

- **61 tests passed in 41.67 seconds** in the latest completed full run.
- **98% statement coverage** for the `roleready` library (259 of 263 statements). The Streamlit UI is exercised separately through AppTest; this percentage does not describe all of `app.py`.
- Static code check: `ruff check .` passed after the final edits.
- All Python sources parsed successfully.
- Both Mac scripts passed `bash -n` syntax validation. A fresh end-user Mac installation was not separately tested.
- Installed dependency requirements were checked against installed versions with `importlib.metadata` and `packaging`: no conflicts. `requirements-tested.txt` records that environment. The `pip check` command itself stalled during dependency loading and was interrupted.
- The app was launched on loopback and inspected in an actual browser. Demo load, the 75/100 authored report, evidence table, bullet studio, and an accepted refinement with visible history were verified. The preview image in the delivery is from that local demo. The preview server was stopped after verification.
- The ZIP was checked for integrity and required files, and excludes keys, `.env`, virtual environments, and generated caches.

## What the completed test run covered

Actual PDF and DOCX parsing; DOCX tables; malformed, empty, oversized, encrypted, scanned/blank and overlong documents; archive expansion and macro rejection; source-quote checks; unsupported numeric claims; score calculation; structured-output validation; authored demo variants; report provenance and export history; OpenAI SDK request serialization and parsing through an offline HTTP mock; authentication, permission, quota, server, request, connection and timeout errors; refusal/incomplete/malformed output; refinement grounding; input freshness; consent gating; session clearing; and a five-refinement limit.

## Final repeat limitation

After the completed 61-test run, two small interface-state fixes were made: Demo mode resets its displayed persona to the authored supportive-coach voice, and switching to pasted resume input clears the old upload fingerprint. One regression test was added for these states, bringing the included suite to **62 tests**.

The final 62-test repeat was attempted with the installed environment, explicit plugin loading, a fresh cache, and the bundled Python executable. Local dependency imports intermittently stalled on file reads, so those attempts were interrupted before a complete result. **A final 62/62 pass is not claimed.** Static checking and source parsing passed on the delivered sources. Run the included suite on your own machine with the README commands to repeat verification.

## Live API status

**Not tested with a real OpenAI API key.** No real model output or live factual-quality measurement is claimed. All API-response tests use the real SDK with controlled, clearly identified offline fixtures. Demo reports and demo refinements are human-authored fictional examples. The README includes a live acceptance checklist for use with your own key.

Source and numeric checks cannot guarantee semantic truth. Review every generated draft before use.
