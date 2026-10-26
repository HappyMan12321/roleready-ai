# Web migration verification — October 26, 2026

- Next.js **16.4.3**, React **19.3.1**, Node **24.20.0** locally. Exact dependency versions are in `package-lock.json`.
- Final production build passed.
- Type generation and strict TypeScript checking passed (`npm run typecheck`).
- **45 tests passed** across 3 files in the final completed suite (1.04 seconds).
- Production dependency audit: **0 vulnerabilities** reported by `npm audit --omit=dev` at verification time.
- Production deployment reached Vercel `READY`; public alias https://roleready-ai-beta.vercel.app.
- Production HTTP checks: generated fictional PDF extraction **200**, generated fictional DOCX extraction **200**, readiness **200** with `liveEnabled:false`, live analysis **503** with safe disabled feedback and no fabricated analysis.
- Actual browser checks: desktop landing and review screens; evidence filtering and exact quotes; demo preview/accept/restore; action checklist; actual text-report download; entered materials preserved while entering/leaving the demo; phone layout without horizontal document overflow. Phone section navigation appeared about 346 CSS pixels from the measured view top, versus approximately 1,140 in the former Streamlit UI.
- No real OpenAI key was configured. Model-response tests use explicit offline fixtures through the real SDK. Live quality, billing, and account-specific model access have not been tested.

There is no database; Supabase is deferred until account-based persistence is requested. Browser state is memory only and does not survive refresh.

Source and number checks cannot establish full factual meaning. Human review remains required.
