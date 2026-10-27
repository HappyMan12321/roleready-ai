# RoleReady Web

RoleReady’s Next.js + React + TypeScript web application, deployed on Vercel.

**Live site:** https://roleready-ai-beta.vercel.app

The fictional demo works without an API key. Live analysis is intentionally disabled until the owner configures server credentials and a private review access code. No live AI results are bundled or claimed.

## Run locally on a Mac

Install Node.js 22 or 24 from nodejs.org, then open Terminal in this folder:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Do not overwrite an existing `.env.local`. No Python setup is needed for the web app.

## UX improvements

The complete screen-by-screen review is implemented in this web app. See [UX_IMPROVEMENTS.md](UX_IMPROVEMENTS.md) for the mapping and verification. Wording changes, action-item shortcuts, explicit session controls, accessible tabs, and in-context setup/validation are included.

## Features

- Responsive desktop and phone workspace with early, sticky section navigation.
- Separate fictional demo and personal application state. Exploring the demo never replaces entered materials.
- PDF/DOCX upload with editable extracted text, or pasted resume and job description.
- Structured requirement matching with exact source quotes, evidence filters, transparent alignment heuristic, and prioritized actions.
- Three prompting personas, original few-shot examples, and iterative refinement using the latest selected draft.
- Generated or manual revisions remain previews until explicitly accepted. Restore any saved version without another API request.
- Existing reviews survive edits and failed requests. Changed inputs mark the prior report as out of date and disable new generation against stale context; the reviewed inputs can be restored.
- Session-only action checkboxes; copy draft; text/JSON exports and browser print-to-PDF. JSON excludes complete source materials and access codes but contains evidence excerpts.
- New-review confirmation with a download-first option.

## Vercel deployment

The app requires a Node.js server runtime; do not use a static export.

In a repository containing this folder under `web`, choose **Root Directory `web`**, Framework **Next.js**, Node **24.x**, install `npm ci`, and build `npm run build`. For the standalone download, use the app folder root. The standard Next.js output setting is sufficient.

```bash
npx vercel login
npx vercel link
npx vercel deploy --prod
```

The existing Vercel project is `roleready-ai`, under the account’s `care-circle4` scope. AI functions have a 120-second limit; extraction has 30 seconds. The SDK uses a 45-second timeout with one retry.

The source lives in `web/` in the existing `HappyMan12321/roleready-ai` repository. Vercel uses `web` as its root directory. The GitHub connection publishes production builds from `main` and preview builds for branches.

### Enable live AI later

In the Vercel project’s **Settings → Environment Variables**, set these server-only variables:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your own API key |
| `OPENAI_MODEL` | `gpt-4o-mini` or an accessible model supporting Responses and Structured Outputs |
| `ROLEREADY_ACCESS_CODE` | A long, private code shared only with trusted reviewers |
| `ROLEREADY_LIVE_ENABLED` | `true` after credentials are configured |

Redeploy to apply the environment. Never prefix credentials with `NEXT_PUBLIC_` and never commit them. Visitors do not enter an OpenAI key. The owner’s key is used only by server routes. A ChatGPT subscription does not itself provide API access or credit.

Live availability requires the enabled flag, API key, and access code. Analysis and refinement both require explicit consent and the correct private code. Keep demo-only mode until ready to test billing and output quality.

**Live API testing still requires the user’s key.** The deployed API currently returns safe disabled feedback, never a substitute demo result.

## Why there is no Supabase database yet

This MVP has no sign-in, cross-device history, or saved applications. React memory holds the workspace while the page is open; refreshing or closing it loses that state. No resume or report is written to a database or browser storage. Downloads are the user’s responsibility.

Supabase becomes useful when account-based persistence is requested. That addition should include Supabase Auth, per-user row-level security, explicit save/delete controls, and a retention policy. Do not create public resume tables or expose a service-role key in the browser. No Supabase project or credentials are needed for this version.

## Privacy, security, errors, and limits

- Uploads go to RoleReady’s server for in-memory extraction. Live analysis sends resume and job text; refinement also includes original/latest draft and feedback, after consent. Provider retention policies apply despite `store:false`.
- Application code does not persist or log document contents or access codes. Vercel may retain platform metadata and error logs under its policies; this is not a zero-retention promise.
- API key and model are server-configured, with the OpenAI endpoint fixed to `https://api.openai.com/v1`.
- React escapes document/model text. No model HTML is injected. Security headers restrict framing, embedded objects, resource origins, and sensor access.
- Same-origin checks, bounded bodies, consent schemas, and a timing-safe private-code check protect live endpoints. The in-memory throttle is **best effort per server instance**, not a durable distributed quota. Five previews is a UX limit, not server-enforced billing protection. Configure Vercel Firewall/rate limits and provider spending alerts before broader access; add per-user authentication and durable quotas for a public paid service.
- Maximum upload: **4 MB**, below Vercel’s 4.5 MB request limit. PDFs: 20 pages. Resume: 24,000 characters. Job: 18,000. Feedback: 1,500. DOCX: 200 ZIP members and 20 MB actual expanded data; encrypted/macro-containing archives are rejected. No OCR or `.doc` support.
- Parsing is bounded but not separately sandboxed. Use trusted files. Complex reading order, headers, and text boxes may extract imperfectly; correct the preview.
- Source quotes, duplicate requirements, and numeric tokens are checked. These checks do not establish semantic truth or detect every invented responsibility, causal claim, or skill. Verify every draft.
- OpenAI failures, incomplete output, and malformed/ungrounded results return safe errors. Previous reviews remain available.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Tests use the real OpenAI SDK with mocked HTTP, never a real key. They cover actual PDF/DOCX parsing, strict schemas, grounding, numbers, consent, same-origin protection, live gating, body bounds, safe errors, accepted drafts, restoration, and exports. See `TEST_RESULTS.md` for executed production checks.

## Structure

```text
app/                      Next.js entry, layout, styles, error page
app/api/analyze/          Structured analysis endpoint
app/api/refine/           Structured revision endpoint
app/api/extract/          In-memory PDF/DOCX extraction
app/api/status/           Readiness boolean (no secrets)
components/workspace.tsx  Responsive workspace workflow
lib/                      Schemas, prompts, authored demo, checks, exports
tests/                    Offline regression and document tests
```

The original Streamlit prototype remains in the repository root. No Streamlit server is required on Vercel.

## Primary references

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://vercel.com/docs/functions/limitations
- https://github.com/unjs/unpdf
