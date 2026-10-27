"use client";
import { useState } from "react";
import {
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react";
import { Materials, personas } from "@/lib/schema";
import { validateText } from "@/lib/validation";
export type Availability = "checking" | "ready" | "disabled" | "error";
type Props = {
  materials: Materials;
  onChange: (next: Materials) => void;
  hasReview: boolean;
  onClose: () => void;
  busy: string;
  filename: string;
  onUpload: (file: File) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  accessCode: string;
  setAccessCode: (v: string) => void;
  availability: Availability;
  onRetry: () => void;
  onAnalyze: () => void;
  openDemo: () => void;
  clearMaterials: () => void;
};
function issue(value: string, label: string, max: number) {
  try {
    validateText(value, label, max);
    return "";
  } catch (error) {
    return (error as Error).message;
  }
}
export default function MaterialsEditor(p: Props) {
  const [mode, setMode] = useState<"paste" | "upload">(
    p.filename ? "upload" : "paste",
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const resumeIssue = issue(p.materials.resume, "Resume", 24000),
    jobIssue = issue(p.materials.job, "Job description", 18000);
  const live = p.availability === "ready";
  const change = (field: keyof Materials, value: string) =>
    p.onChange({ ...p.materials, [field]: value });
  return (
    <section className="materials-section" aria-label="Review materials">
      {p.hasReview && (
        <div className="section-title">
          <h2>Edit your materials</h2>
          <button className="text-button" onClick={p.onClose}>
            Close editor <X size={16} />
          </button>
        </div>
      )}
      <div
        className={`setup-status ${p.availability}`}
        role="status"
        aria-label="Review availability"
      >
        <div>
          <strong>
            {live
              ? "Ready for your private review"
              : p.availability === "checking"
                ? "Checking review availability…"
                : p.availability === "error"
                  ? "We couldn’t check live availability"
                  : "Your workspace is ready. Live AI is not enabled yet."}
          </strong>
          <p>
            {live
              ? "Add your materials, enter the private access code, and confirm sharing below."
              : p.availability === "error"
                ? "Your materials are safe. Retry the connection, or explore the demo."
                : "You can prepare your application here or explore the complete fictional demo. No API request will be made."}
          </p>
        </div>
        {p.availability === "error" ? (
          <button className="secondary" onClick={p.onRetry}>
            Retry availability
          </button>
        ) : (
          !live && (
            <button className="text-button" onClick={p.openDemo}>
              Explore demo
            </button>
          )
        )}
      </div>
      <div className="field role-field">
        <label htmlFor="role">
          Role or application name <span>(optional)</span>
        </label>
        <input
          id="role"
          maxLength={100}
          value={p.materials.role}
          onChange={(e) => change("role", e.target.value)}
          placeholder="e.g. Data Analyst · Harbor Retail"
        />
      </div>
      <div className="materials-grid">
        <article className="input-card">
          <div className="card-title">
            <span className="number-chip">01</span>
            <h2>Your resume</h2>
            <FileText size={18} />
          </div>
          <fieldset className="input-method">
            <legend>Resume input</legend>
            {(["paste", "upload"] as const).map((m) => (
              <label key={m}>
                <input
                  type="radio"
                  name="resume-input-method"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                {m === "paste" ? "Paste text" : "Upload a file"}
              </label>
            ))}
          </fieldset>
          {mode === "upload" && (
            <>
              <label className={`upload-button ${p.busy ? "disabled" : ""}`}>
                <Upload size={17} /> Choose PDF or DOCX
                <input
                  type="file"
                  accept=".pdf,.docx"
                  disabled={!!p.busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) p.onUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="helper">
                Up to 4 MB. Image-only PDFs aren’t supported—paste the text
                instead. Files go to the server for extraction and aren’t saved.
              </p>
              {p.filename && (
                <p className="file-success">
                  <Check size={15} />
                  {p.filename} · Text extracted
                </p>
              )}
            </>
          )}
          {(mode === "paste" || !!p.materials.resume) && (
            <div className="field">
              <label htmlFor="resume">
                {mode === "upload" && p.filename
                  ? "Check extracted text"
                  : "Resume text"}
              </label>
              <textarea
                id="resume"
                maxLength={24000}
                value={p.materials.resume}
                onBlur={() => setTouched((t) => ({ ...t, resume: true }))}
                onChange={(e) => change("resume", e.target.value)}
                placeholder="Your experience, projects, skills, and education…"
                aria-describedby="resume-help"
                aria-invalid={touched.resume && !!resumeIssue}
              />
            </div>
          )}
          <div className="field-status" id="resume-help">
            <span
              className={
                !resumeIssue ? "valid" : touched.resume ? "invalid" : ""
              }
            >
              {!resumeIssue ? (
                <>
                  <Check size={14} /> Ready to review
                </>
              ) : touched.resume ? (
                resumeIssue
              ) : (
                "At least 80 characters and 12 words"
              )}
            </span>
            <span>{p.materials.resume.length.toLocaleString()} / 24,000</span>
          </div>
        </article>
        <article className="input-card">
          <div className="card-title">
            <span className="number-chip">02</span>
            <h2>The opportunity</h2>
            <Target size={18} />
          </div>
          <p className="helper job-helper">
            Include responsibilities, required skills, and preferred
            qualifications so the review has the full picture.
          </p>
          <div className="field">
            <label htmlFor="job">Job description</label>
            <textarea
              id="job"
              maxLength={18000}
              value={p.materials.job}
              onBlur={() => setTouched((t) => ({ ...t, job: true }))}
              onChange={(e) => change("job", e.target.value)}
              placeholder="Paste the full job description here…"
              aria-describedby="job-help"
              aria-invalid={touched.job && !!jobIssue}
            />
          </div>
          <div className="field-status" id="job-help">
            <span
              className={!jobIssue ? "valid" : touched.job ? "invalid" : ""}
            >
              {!jobIssue ? (
                <>
                  <Check size={14} /> Ready to review
                </>
              ) : touched.job ? (
                jobIssue
              ) : (
                "At least 80 characters and 12 words"
              )}
            </span>
            <span>{p.materials.job.length.toLocaleString()} / 18,000</span>
          </div>
        </article>
      </div>
      <div className="materials-toolbar">
        <p className="helper">
          Materials stay in memory while this page is open. Download reviews to
          keep a copy.
        </p>
        <button
          className="text-button"
          onClick={p.clearMaterials}
          disabled={!p.materials.resume && !p.materials.job}
        >
          Clear materials
        </button>
      </div>
      <div className="review-settings">
        <div className="field">
          <label htmlFor="persona">Coaching voice</label>
          <select
            id="persona"
            value={p.materials.persona}
            onChange={(e) => change("persona", e.target.value)}
          >
            {personas.map((persona) => (
              <option key={persona}>{persona}</option>
            ))}
          </select>
        </div>
        {live && (
          <div className="field">
            <label htmlFor="access-code">Private review access code</label>
            <input
              id="access-code"
              type="password"
              autoComplete="off"
              maxLength={200}
              value={p.accessCode}
              onChange={(e) => p.setAccessCode(e.target.value)}
            />
          </div>
        )}
      </div>
      <details className="connection-details">
        <summary>Connection & privacy details</summary>
        <p>
          The app owner configures the OpenAI model and API key on the server.
          They never enter this browser. Your private access code is kept only
          in this page’s memory.
        </p>
      </details>
      <div className="consent-area">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={p.consent}
            onChange={(e) => p.setConsent(e.target.checked)}
          />
          <span>
            I agree to send these materials and refinement context to OpenAI.
            Remove contact details or sensitive information you don’t want to
            share.
          </span>
        </label>
        <div className="analyze-row">
          <button
            className="primary"
            disabled={
              !!p.busy ||
              !!resumeIssue ||
              !!jobIssue ||
              !p.consent ||
              !live ||
              !p.accessCode.trim()
            }
            onClick={p.onAnalyze}
          >
            {p.busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {p.hasReview ? "Update review" : "Analyze job match"}
          </button>
          <span className="helper">
            {!live
              ? "Live AI is unavailable; your materials and previous review are unchanged."
              : resumeIssue || jobIssue
                ? "Add both materials to continue."
                : !p.consent
                  ? "Confirm sharing consent to continue."
                  : !p.accessCode.trim()
                    ? "Enter your private access code to continue."
                    : "Live requests may incur API charges."}
          </span>
        </div>
      </div>
    </section>
  );
}
