# UX review implementation

The pasted review referred to the former Streamlit app. These improvements are implemented in the hosted Next.js web app; the old Python prototype remains available in the repository root.

| Review item | Implemented behavior |
| --- | --- |
| Preserve work | Edits mark the existing review as stale; no report or accepted revision is deleted. Failed requests retain it. Restore reviewed inputs without another API request. |
| Earlier navigation | A compact role/date/time header leads directly to sticky section tabs. Summary and score appear only in Overview. |
| Sidebar contrast | Dark sidebar surfaces, readable text, a persistent close control, Escape dismissal, focus return, keyboard containment, and an inert closed drawer. |
| Accidental demo replacement | Fictional sample and personal application have separate state. Demo materials are read-only. Returning restores entered materials. |
| Focused landing | Review my resume is primary; demo is secondary. The input workspace appears only after choosing a route. |
| Clear setup | Main-workspace availability panel with retry on connection errors. The model/API key are owner-configured on the server, rather than visitor-facing technical inputs. |
| Form validation | Aligned field labels, fewer nested cards, clear minimums and counts, field-specific blur feedback, and explained disabled actions. |
| Upload preview | Choose paste or upload. Empty upload mode has no misleading text preview. Successful extraction displays the filename and editable Check extracted text field; old text survives failures. Plain-language PDF limitations. |
| Overview | Role and review date/time are visible. Primary emphasis is next steps and summary; the smaller score explicitly disclaims ATS/hiring predictions. |
| Evidence | Attention-first filter, required-before-preferred ordering, counts, compact expandable rows, exact source excerpts, and named status labels with color. |
| Bullet selection/copy | Visible bullet cards, acceptance indicators, explicit Copy draft action, and retained original beside the selected current draft. |
| Wording comparisons | Word-level added/removed highlights for original versus current and current versus preview. Underlines/strikethrough and accessible labels accompany color. Document/model strings remain escaped React text. |
| Draft acceptance/history | Every generated/manual revision is a preview until accepted. Dismiss a candidate without replacing the current draft; restore saved versions without a request. |
| Repeated previews | Unchanged output and previously seen previews do not consume another preview allowance. Manual edits use no API request or allowance. The allowance is a UI limit, not server-side billing protection. |
| Actionable next steps | Session checkboxes and per-action shortcuts to source requirements and actual bullet cards. Links use overlapping terms, not invented model judgments. Readability advice and interview preparation are separate. |
| Exports | Persistent download, role/date filenames, readable preview, JSON, and browser print/save-PDF. Exports use the selected current drafts, retain accepted history, and identify demo provenance. |
| Session controls | New review confirms replacement and preserves access code/coaching voice; Clear materials removes only inputs and preserves the old review; Remove access code leaves materials and drafts intact. Server API keys never enter the browser. |
| Legibility and contrast | Secondary labels generally 13–14 px, mobile labels at least 12 px, darker foregrounds, stronger input boundaries, visible focus, and less visual nesting. Branding is decorative. |
| Heading/keyboard structure | H1/H2/H3 hierarchy, genuine tablist/tabpanel relationships, Arrow/Home/End navigation, focus after section changes, native expandable evidence, and linked input errors. |
| Phone layouts | Deliberate two-column tab grid with a full-width Export control; stacked input/draft/evidence layouts; no horizontal page overflow in the phone check. |
| Finished product chrome | No Streamlit Deploy or development controls in the production app. |

## Verification

65 offline tests pass, including 13 rendered-workspace regression tests and 7 focused UX/helper tests in addition to the original 45 web tests. Checks cover preservation after failed re-analysis, demo isolation, upload preview, validation, session controls, explicit acceptance/restoration, duplicate preview allowance, action shortcuts, keyboard tabs, and escaped wording differences. TypeScript and production build pass.

Live API output is not tested without the user's key. Browser checks use authored fictional demo data. No database, analytics, or new provider connection was added.
