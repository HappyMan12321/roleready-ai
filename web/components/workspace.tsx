"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Download,
  FileText,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Menu,
  PencilLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react";
import {
  AnalysisSchema,
  Materials,
  Report,
  Revision,
  RevisionSchema,
  personas,
  statusLabel,
} from "@/lib/schema";
import {
  acceptRevision,
  activeDraft,
  exportFilename,
  exportJson,
  fingerprint,
  reportText,
  restoreRevision,
} from "@/lib/report";
import { AppError, matchScore, validateRevision } from "@/lib/validation";
import demo from "@/lib/demo.json";
import MaterialsEditor, { Availability } from "./materials-editor";
import WordDiff from "./word-diff";
import { actionTargets, isKnownDraft } from "@/lib/ux";

type View =
  "Overview" | "Match evidence" | "Bullet studio" | "Action plan" | "Export";
const views: { name: View; icon: typeof Target }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Match evidence", icon: Target },
  { name: "Bullet studio", icon: PencilLine },
  { name: "Action plan", icon: ListChecks },
  { name: "Export", icon: Download },
];
const blank: Materials = {
  resume: "",
  job: "",
  role: "",
  persona: personas[0],
};
function makeDemo(): Report {
  return {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    source: "demo",
    materials: {
      resume: demo.resume,
      job: demo.job,
      role: "Junior Data Analyst · Harbor Retail",
      persona: personas[0],
    },
    analysis: AnalysisSchema.parse(demo.analysis),
    revisions: [],
    active: {},
    previewCount: 0,
  };
}
function saveFile(content: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw Error(
      "The server could not complete this request. Your previous review is unchanged.",
    );
  }
  if (!response.ok) throw Error(value.error || "Please try again later.");
  return value;
}

export default function Workspace() {
  const [started, setStarted] = useState(false),
    [isDemo, setIsDemo] = useState(false),
    [menu, setMenu] = useState(false);
  const [materials, setMaterials] = useState<Materials>(blank),
    [userReport, setUserReport] = useState<Report | null>(null),
    [demoReport, setDemoReport] = useState<Report | null>(null);
  const [view, setView] = useState<View>("Overview"),
    [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState<"new" | "materials" | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false),
    [consent, setConsent] = useState(false),
    [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(0),
    [filter, setFilter] = useState("attention"),
    [feedback, setFeedback] = useState(""),
    [style, setStyle] = useState("Concise");
  const [pending, setPending] = useState<Record<string, Revision>>({}),
    [tasks, setTasks] = useState<Record<string, boolean>>({}),
    [manual, setManual] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [filename, setFilename] = useState("");
  const [seenDrafts, setSeenDrafts] = useState<Record<string, Revision[]>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(
    new Set(),
  );
  const [focusedRequirement, setFocusedRequirement] = useState<string | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const lastDialogTrigger = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null);
  const report = isDemo ? demoReport : userReport;
  const stale =
    !!report &&
    !isDemo &&
    fingerprint(materials) !== fingerprint(report.materials);
  async function checkAvailability() {
    setAvailability("checking");
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw Error("Unavailable");
      const value = await response.json();
      setLiveEnabled(value.liveEnabled === true);
      setAvailability(value.liveEnabled === true ? "ready" : "disabled");
    } catch {
      setLiveEnabled(false);
      setAvailability("error");
    }
  }
  useEffect(() => {
    void checkAvailability();
  }, []);
  useEffect(() => {
    if (confirm) {
      lastDialogTrigger.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      lastDialogTrigger.current?.focus();
    }
  }, [confirm]);
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => {
      if (materials.resume || materials.job || userReport) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [materials, userReport]);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const mobile = window.matchMedia("(max-width: 1000px)");
    const sync = () => {
      if (sidebar) sidebar.inert = mobile.matches && !menu;
    };
    sync();
    mobile.addEventListener("change", sync);
    if (menu && mobile.matches)
      sidebar?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    return () => mobile.removeEventListener("change", sync);
  }, [menu]);
  function closeMenu() {
    setMenu(false);
    menuButtonRef.current?.focus();
  }
  function drawerKey(event: React.KeyboardEvent<HTMLElement>) {
    if (!menu || !window.matchMedia("(max-width: 1000px)").matches) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), summary, input, a[href]",
      ) ?? [],
    ).filter((e) => e.getClientRects().length > 0);
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const updateReport = (next: Report) =>
    isDemo ? setDemoReport(next) : setUserReport(next);
  const openDemo = () => {
    if (!demoReport) setDemoReport(makeDemo());
    setIsDemo(true);
    setStarted(true);
    setEditing(false);
    setSelected(0);
    setManual(null);
    setView("Overview");
    setMenu(false);
    setError("");
    setNotice("");
  };
  const ownWorkspace = () => {
    setIsDemo(false);
    setStarted(true);
    setSelected(0);
    setManual(null);
    setView("Overview");
    setMenu(false);
    setEditing(!userReport);
    setError("");
    setNotice("");
  };
  const navigate = (next: View) => {
    setView(next);
    setMenu(false);
    setError("");
    requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
      contentRef.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    });
  };
  const fresh = () => {
    setMaterials({ ...blank, persona: materials.persona });
    setUserReport(null);
    setIsDemo(false);
    setStarted(true);
    setEditing(true);
    setSelected(0);
    setManual(null);
    setFeedback("");
    setConsent(false);
    setFilename("");
    setManual(null);
    setPending({});
    setSeenDrafts({});
    setExpandedEvidence(new Set());
    setFocusedRequirement(null);
    setTasks({});
    setConfirm(null);
    setView("Overview");
    setError("");
    setNotice("A fresh workspace is ready.");
  };
  function clearMaterials() {
    setMaterials((m) => ({ ...m, resume: "", job: "" }));
    setFilename("");
    setConsent(false);
    setConfirm(null);
    setNotice(
      "Materials cleared. Your previous review, drafts, and connection settings are preserved.",
    );
  }
  function openRequirement(index: number) {
    if (!report) return;
    const item = report.analysis.requirements[index];
    setFilter("all");
    setFocusedRequirement(item.requirement);
    setExpandedEvidence(
      (current) => new Set([...current, `${report.id}-${item.requirement}`]),
    );
    navigate("Match evidence");
    requestAnimationFrame(() =>
      document
        .getElementById(`requirement-${index}`)
        ?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  }
  function openBullet(index: number) {
    setSelected(index);
    setManual(null);
    navigate("Bullet studio");
  }
  async function analyze() {
    if (!consent) {
      setError("Confirm sharing consent before sending materials to OpenAI.");
      return;
    }
    const snapshot = { ...materials };
    setBusy("Reviewing your experience…");
    setError("");
    try {
      const value = await request("/api/analyze", {
        resume: snapshot.resume,
        job: snapshot.job,
        persona: snapshot.persona,
        consent: true,
        accessCode,
      });
      const analysis = AnalysisSchema.parse(value.analysis);
      setUserReport({
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        source: "openai",
        materials: snapshot,
        analysis,
        revisions: [],
        active: {},
        previewCount: 0,
      });
      setEditing(false);
      setSelected(0);
      setManual(null);
      setView("Overview");
      setNotice(
        "Your new review is ready. Verify every claim before using a draft.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function upload(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Use a text-based PDF or DOCX, or paste your resume text.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Choose a PDF or DOCX up to 4 MB.");
      return;
    }
    setBusy("Extracting resume text…");
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/extract", {
        method: "POST",
        body: data,
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error || "This document could not be read.");
      setMaterials((m) => ({ ...m, resume: value.text }));
      setFilename(file.name);
      setNotice(
        "Text extracted. Check its reading order and correct any formatting before reviewing.",
      );
    } catch (e) {
      setError(
        (e as Error).message ||
          "The file could not be read. Paste your text instead.",
      );
    } finally {
      setBusy("");
    }
  }
  async function refine() {
    if (!report) return;
    const bullet = report.analysis.bullet_rewrites[selected];
    const current = activeDraft(report, bullet.original);
    setBusy("Finding clearer wording…");
    setError("");
    try {
      let revision: Revision;
      if (isDemo) {
        revision = RevisionSchema.parse(
          (demo.variants as Record<string, Record<string, Revision>>)[
            bullet.original
          ][style],
        );
      } else {
        if (!consent)
          throw Error(
            "Confirm sharing consent in Your materials before refining.",
          );
        const value = await request("/api/refine", {
          resume: report.materials.resume,
          job: report.materials.job,
          persona: report.materials.persona,
          original: bullet.original,
          draft: current,
          feedback,
          consent: true,
          accessCode,
        });
        revision = RevisionSchema.parse(value.revision);
      }
      if (revision.rewritten === current) {
        setNotice(
          "That wording is already your current draft. No preview was used.",
        );
        return;
      }
      const repeated = isKnownDraft(
        report,
        revision,
        seenDrafts[report.id] ?? [],
      );
      setPending((p) => ({ ...p, [report.id]: revision }));
      if (!repeated) {
        setSeenDrafts((values) => ({
          ...values,
          [report.id]: [...(values[report.id] ?? []), revision],
        }));
        updateReport({ ...report, previewCount: report.previewCount + 1 });
      } else
        setNotice(
          "You’ve seen this wording before. It is available to preview again without using your allowance.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function clearPending() {
    if (report)
      setPending((p) => {
        const next = { ...p };
        delete next[report.id];
        return next;
      });
  }
  const bullet = report?.analysis.bullet_rewrites[selected],
    candidate = report ? pending[report.id] : undefined;
  const active = report && bullet ? activeDraft(report, bullet.original) : "";
  const counts = report
    ? {
        matched: report.analysis.requirements.filter(
          (r) => r.status === "matched",
        ).length,
        partial: report.analysis.requirements.filter(
          (r) => r.status === "partial",
        ).length,
        missing: report.analysis.requirements.filter(
          (r) => r.status === "missing",
        ).length,
      }
    : null;
  const exportReview = () => {
    if (report) saveFile(reportText(report), exportFilename(report, "txt"));
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      )}
      <aside
        ref={sidebarRef}
        onKeyDown={drawerKey}
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={25} />
          </span>
          <div>
            RoleReady<span>CAREER WORKSPACE</span>
          </div>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={closeMenu}
          >
            <X />
          </button>
        </div>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <button
          className="new-review"
          onClick={() =>
            materials.resume || materials.job || userReport
              ? setConfirm("new")
              : ownWorkspace()
          }
          disabled={!!busy}
        >
          <Plus size={18} /> New review
        </button>
        <button
          className={`side-link ${!isDemo && started ? "active" : ""}`}
          onClick={ownWorkspace}
          disabled={!!busy}
        >
          <FileText size={18} /> My application
        </button>
        <button
          aria-label="Explore fictional demo"
          className={`side-link ${isDemo ? "active" : ""}`}
          onClick={openDemo}
          disabled={!!busy}
        >
          <Sparkles size={18} /> Explore demo
          <span className="mini-badge">FREE</span>
        </button>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <strong>Your story stays yours.</strong>
          <p>
            No account or database storage. Materials stay in memory while this
            page is open. Download your review to keep it.
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="connection">
            <span className={`dot ${liveEnabled ? "ready" : ""}`} />
            {liveEnabled
              ? "Live reviews available"
              : "Demo ready · Live coming soon"}
          </div>
          <details>
            <summary>
              <CircleHelp size={15} /> Privacy & limits
            </summary>
            <p>
              Uploads are sent to the server for text extraction. Live reviews
              send materials and draft context to OpenAI only after consent.
              Provider retention policies apply. Source checks cannot guarantee
              truth.
            </p>
            <p>
              Use files you trust. 4 MB, 20 PDF pages. Text-only PDF or DOCX.
            </p>
            <button
              className="session-control"
              disabled={isDemo || (!materials.resume && !materials.job)}
              onClick={() => setConfirm("materials")}
            >
              Clear materials
            </button>
            <button
              className="session-control"
              disabled={!accessCode}
              onClick={() => {
                setAccessCode("");
                setNotice(
                  "Access code removed from this page. Your materials and saved drafts are unchanged.",
                );
              }}
            >
              Remove access code
            </button>
            <p>
              The OpenAI API key stays on the server. New review preserves your
              connection settings.
            </p>
          </details>
          <small>Made for your next chapter.</small>
        </div>
      </aside>
      <div className="workspace-shell">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="icon-button menu-button"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {isDemo
                ? "Fictional example"
                : started
                  ? "My application"
                  : "Welcome"}
            </strong>
          </span>
          <span className="private-badge">
            <ShieldCheck size={14} /> Private by design
          </span>
        </header>
        <main id="main-content" ref={mainRef}>
          {!started ? (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">EXPERIENCE → OPPORTUNITY</span>
                  <h1>
                    Your experience,
                    <br />
                    <em>clearly expressed.</em>
                  </h1>
                  <p>
                    Connect what you’ve done with what a role needs. Find your
                    strongest evidence and tell a clearer story, without
                    stretching the truth.
                  </p>
                  <div className="hero-actions">
                    <button className="primary" onClick={ownWorkspace}>
                      Review my resume <ArrowRight size={17} />
                    </button>
                    <button className="secondary" onClick={openDemo}>
                      Explore the demo
                    </button>
                  </div>
                  <div className="hero-proof">
                    <Check size={15} /> No account needed <span>·</span> Free
                    fictional demo
                  </div>
                </div>
                <div
                  className="sample-preview"
                  aria-label="Illustrative fictional demo preview"
                >
                  <div className="preview-top">
                    <span className="preview-icon">
                      <Target size={20} />
                    </span>
                    <span>YOUR EXPERIENCE, IN FOCUS</span>
                    <span className="sample-tag">DEMO</span>
                  </div>
                  <h2>A clearer path forward.</h2>
                  <div className="preview-score">
                    <strong>
                      75<span>/100</span>
                    </strong>
                    <p>
                      Illustrative evidence alignment
                      <br />
                      <small>Not an ATS score or hiring prediction</small>
                    </p>
                  </div>
                  <div className="score-track">
                    <span />
                  </div>
                  <div className="preview-row">
                    <span>SQL & Python</span>
                    <span className="badge matched">
                      <Check size={12} /> Matched
                    </span>
                  </div>
                  <div className="preview-row">
                    <span>Stakeholder communication</span>
                    <span className="badge partial">Needs clarity</span>
                  </div>
                  <div className="preview-tip">
                    <Sparkles size={17} />
                    <p>Make the experience you already have easier to see.</p>
                  </div>
                  <small>Authored fictional example. No AI request.</small>
                </div>
              </section>
              <section className="steps" aria-label="How it works">
                {[
                  {
                    icon: FileText,
                    title: "Bring your experience",
                    text: "Paste your resume or upload a PDF or DOCX, then add the job description.",
                  },
                  {
                    icon: Target,
                    title: "Understand your match",
                    text: "See the source evidence behind each match and where more context could help.",
                  },
                  {
                    icon: PencilLine,
                    title: "Make your words count",
                    text: "Preview stronger wording, keep the facts, and choose the version that feels like you.",
                  },
                ].map((s, i) => (
                  <article key={s.title}>
                    <span className="step-index">0{i + 1}</span>
                    <s.icon size={22} />
                    <h2>{s.title}</h2>
                    <p>{s.text}</p>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {report
                      ? "YOUR APPLICATION REVIEW"
                      : "LET’S START WITH YOUR EXPERIENCE"}
                  </span>
                  <h1>
                    {report
                      ? report.materials.role || "Your resume review"
                      : "A stronger application starts here."}
                  </h1>
                  <p>
                    {report
                      ? `${isDemo ? "Authored fictional demo · No API call" : "OpenAI review"} · ${new Date(report.created).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                      : "Add your materials. Every suggestion starts with the experience you provide."}
                  </p>
                </div>
                {report && (
                  <button
                    className="secondary download-top"
                    onClick={exportReview}
                  >
                    <Download size={16} /> Download review
                  </button>
                )}
              </div>
              {isDemo && (
                <div className="demo-banner">
                  <Sparkles size={17} />
                  <p>
                    <strong>You’re exploring a fictional example.</strong> Your
                    own workspace is safely kept.
                  </p>
                  <button className="text-button" onClick={ownWorkspace}>
                    Back to my application <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {report && (
                <nav
                  className="review-nav"
                  aria-label="Review sections"
                  role="tablist"
                  onKeyDown={(event) => {
                    const index = views.findIndex((v) => v.name === view);
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % views.length
                        : event.key === "ArrowLeft"
                          ? (index + views.length - 1) % views.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? views.length - 1
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      setView(views[next].name);
                      event.currentTarget
                        .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                        [next]?.focus();
                    }
                  }}
                >
                  {views.map((v) => (
                    <button
                      key={v.name}
                      role="tab"
                      id={`review-tab-${v.name.replaceAll(" ", "-")}`}
                      aria-controls="review-panel"
                      aria-selected={view === v.name}
                      tabIndex={view === v.name ? 0 : -1}
                      className={view === v.name ? "selected" : ""}
                      onClick={() => navigate(v.name)}
                    >
                      <v.icon size={16} />
                      {v.name}
                    </button>
                  ))}
                </nav>
              )}
              {notice && (
                <div className="notice" role="status">
                  <CheckCheck size={17} />
                  <span>{notice}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss message"
                    onClick={() => setNotice("")}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {stale && (
                <div className="stale-banner" role="status">
                  <RotateCcw size={18} />
                  <div>
                    <strong>
                      Your inputs changed. This review is preserved.
                    </strong>
                    <p>
                      Update it when you’re ready. Saved drafts and downloads
                      remain available.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (userReport) {
                        setMaterials({ ...userReport.materials });
                        setEditing(false);
                        setNotice("Restored the inputs used for this review.");
                      }
                    }}
                  >
                    Restore reviewed inputs
                  </button>
                </div>
              )}
              {!isDemo && (!report || editing) ? (
                <MaterialsEditor
                  materials={materials}
                  onChange={setMaterials}
                  hasReview={!!report}
                  onClose={() => setEditing(false)}
                  busy={busy}
                  filename={filename}
                  onUpload={(file) => void upload(file)}
                  consent={consent}
                  setConsent={setConsent}
                  accessCode={accessCode}
                  setAccessCode={setAccessCode}
                  availability={availability}
                  onRetry={() => void checkAvailability()}
                  onAnalyze={() => void analyze()}
                  openDemo={openDemo}
                  clearMaterials={() => setConfirm("materials")}
                />
              ) : (
                !isDemo && (
                  <button
                    className="edit-materials"
                    onClick={() => setEditing(true)}
                  >
                    <FileText size={16} />
                    <span>Your materials & review settings</span>
                    <span>{stale ? "Update review" : "Edit materials"}</span>
                    <ChevronRight size={17} />
                  </button>
                )
              )}
              {isDemo && (
                <details className="sample-materials">
                  <summary>
                    <FileText size={16} /> View fictional sample materials{" "}
                    <span>Read only</span>
                  </summary>
                  <h2 className="sr-only">Fictional sample materials</h2>
                  <div className="quote-grid">
                    <div>
                      <h3>Resume</h3>
                      <pre>{demo.resume}</pre>
                    </div>
                    <div>
                      <h3>Job description</h3>
                      <pre>{demo.job}</pre>
                    </div>
                  </div>
                </details>
              )}
              {busy && (
                <div className="loading" role="status">
                  <LoaderCircle className="spin" size={18} />
                  {busy}
                  <span>Your current review stays safe.</span>
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <strong>We couldn’t complete that.</strong>
                  <span>{error}</span>
                  <button className="text-button" onClick={() => setError("")}>
                    Dismiss
                  </button>
                </div>
              )}
              {report && counts && (
                <div
                  className="review-content"
                  key={view}
                  ref={contentRef}
                  id="review-panel"
                  role="tabpanel"
                  aria-labelledby={`review-tab-${view.replaceAll(" ", "-")}`}
                  tabIndex={-1}
                >
                  {view === "Overview" && (
                    <>
                      <div className="section-intro">
                        <span className="eyebrow">SEE THE BIG PICTURE</span>
                        <h2>Your experience, in focus.</h2>
                        <p>
                          A useful starting point for your application. Look at
                          the evidence, then decide what to refine.
                        </p>
                      </div>
                      <div className="overview-grid">
                        <article className="card summary-card">
                          <h3>What your experience shows</h3>
                          <p>{report.analysis.summary}</p>
                          <div className="first-step">
                            <span className="eyebrow">
                              A GOOD PLACE TO START
                            </span>
                            <p>{report.analysis.action_plan[0]}</p>
                            <button
                              className="text-button"
                              onClick={() => navigate("Action plan")}
                            >
                              See your action plan <ArrowRight size={15} />
                            </button>
                          </div>
                        </article>
                        <article className="card score-card">
                          <span className="eyebrow">EVIDENCE ALIGNMENT</span>
                          <div className="score-number">
                            {matchScore(report.analysis)}
                            <span>/100</span>
                          </div>
                          <div className="score-track">
                            <span
                              style={{
                                width: `${matchScore(report.analysis)}%`,
                              }}
                            />
                          </div>
                          <p>
                            A guide to the evidence.
                            <br />
                            Not an ATS score or hiring prediction.
                          </p>
                          <details>
                            <summary>How this is calculated</summary>
                            <p>
                              Required qualifications weigh 2, preferred weigh
                              1. Matched earns full credit, needs clarity half,
                              and not evidenced zero. This is a model-dependent
                              heuristic.
                            </p>
                          </details>
                        </article>
                      </div>
                      <div className="stats">
                        {(["matched", "partial", "missing"] as const).map(
                          (s) => (
                            <button
                              className="card stat"
                              key={s}
                              onClick={() => {
                                setFilter(
                                  s === "matched" ? "matched" : "attention",
                                );
                                navigate("Match evidence");
                              }}
                            >
                              <span className={`status-dot ${s}`} />
                              <strong>{counts[s]}</strong>
                              <span>{statusLabel[s]}</span>
                              <ArrowUpRight size={17} />
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        className="primary"
                        onClick={() => navigate("Match evidence")}
                      >
                        Start with the evidence <ArrowRight size={16} />
                      </button>
                    </>
                  )}
                  {view === "Match evidence" && (
                    <>
                      <div className="section-intro">
                        <h2>The evidence behind the match.</h2>
                        <p>
                          “Not evidenced” means it isn’t in this resume. It
                          doesn’t mean you lack the skill.
                        </p>
                      </div>
                      <div className="filters" aria-label="Filter requirements">
                        {[
                          {
                            key: "attention",
                            title: `Needs attention (${counts.partial + counts.missing})`,
                          },
                          {
                            key: "all",
                            title: `All requirements (${report.analysis.requirements.length})`,
                          },
                          {
                            key: "matched",
                            title: `Matched (${counts.matched})`,
                          },
                        ].map((f) => (
                          <button
                            aria-pressed={filter === f.key}
                            className={filter === f.key ? "chosen" : ""}
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                          >
                            {f.title}
                          </button>
                        ))}
                      </div>
                      <div className="evidence-list">
                        {report.analysis.requirements
                          .filter(
                            (r) =>
                              filter === "all" ||
                              (filter === "matched"
                                ? r.status === "matched"
                                : r.status !== "matched"),
                          )
                          .sort(
                            (a, b) =>
                              Number(a.importance !== "required") -
                              Number(b.importance !== "required"),
                          )
                          .map((r) => (
                            <details
                              className={`evidence-card ${focusedRequirement === r.requirement ? "targeted" : ""}`}
                              id={`requirement-${report.analysis.requirements.findIndex((item) => item.requirement === r.requirement)}`}
                              open={expandedEvidence.has(
                                `${report.id}-${r.requirement}`,
                              )}
                              onToggle={(event) => {
                                const open = event.currentTarget.open;
                                const key = `${report.id}-${r.requirement}`;
                                setExpandedEvidence((current) => {
                                  if (current.has(key) === open) return current;
                                  const next = new Set(current);
                                  if (open) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              key={r.requirement}
                            >
                              <summary>
                                <span>
                                  <strong>{r.requirement}</strong>
                                  <small>
                                    {r.importance === "required"
                                      ? "Required"
                                      : "Preferred"}{" "}
                                    qualification
                                  </small>
                                </span>
                                <span className={`badge ${r.status}`}>
                                  {statusLabel[r.status]}
                                </span>
                                <ChevronRight size={17} />
                              </summary>
                              <div className="evidence-body">
                                <p>{r.explanation}</p>
                                <div className="quote-grid">
                                  <div>
                                    <h3>From the job description</h3>
                                    <blockquote>{r.job_quote}</blockquote>
                                  </div>
                                  <div>
                                    <h3>From your resume</h3>
                                    <blockquote>
                                      {r.resume_evidence ||
                                        "Not evidenced in the provided resume."}
                                    </blockquote>
                                  </div>
                                </div>
                                <div className="next-step">
                                  <strong>Next step</strong>
                                  <p>{r.next_step}</p>
                                </div>
                              </div>
                            </details>
                          ))}
                        {!report.analysis.requirements.some(
                          (r) =>
                            filter === "all" ||
                            (filter === "matched"
                              ? r.status === "matched"
                              : r.status !== "matched"),
                        ) && (
                          <div className="empty-state">
                            <CheckCheck />
                            <h3>No requirements in this view.</h3>
                            <p>
                              Choose All requirements to see your complete
                              review.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {view === "Bullet studio" && (
                    <>
                      <div className="section-intro">
                        <h2>Make one bullet work harder.</h2>
                        <p>
                          Compare the wording, preview a change, and keep the
                          version that tells your story clearly.
                        </p>
                      </div>
                      {!bullet ? (
                        <div className="empty-state">
                          <FileText />
                          <h3>No suitable source bullets were found.</h3>
                          <p>
                            Add a truthful experience or project bullet to your
                            resume and update the review.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div
                            className="bullet-picker"
                            aria-label="Choose a bullet"
                          >
                            {report.analysis.bullet_rewrites.map((b, i) => (
                              <button
                                key={b.original}
                                aria-pressed={selected === i}
                                className={selected === i ? "chosen" : ""}
                                onClick={() => {
                                  setSelected(i);
                                  setManual(null);
                                  setError("");
                                }}
                              >
                                <span>{String(i + 1).padStart(2, "0")}</span>
                                <span>{b.original}</span>
                                {report.active[b.original] && (
                                  <Check size={15} />
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="draft-grid">
                            <article className="card draft-card">
                              <span className="eyebrow">YOUR ORIGINAL</span>
                              <p>{bullet.original}</p>
                            </article>
                            <article className="card draft-card current">
                              <div>
                                <span className="eyebrow">CURRENT DRAFT</span>
                                <button
                                  className="text-button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        active,
                                      );
                                      setNotice(
                                        "Draft copied. Verify every claim before using it.",
                                      );
                                    } catch {
                                      setError(
                                        "Copy isn’t available here. Select the draft text and copy it manually.",
                                      );
                                    }
                                  }}
                                >
                                  <Clipboard size={15} /> Copy draft
                                </button>
                              </div>
                              <p>{active}</p>
                            </article>
                          </div>
                          <p className="helper draft-note">
                            {report.revisions.findLast(
                              (r) =>
                                r.original === bullet.original &&
                                r.rewritten === active,
                            )?.rationale ?? bullet.rationale}{" "}
                            Verify every claim; automated checks cannot
                            establish full factual truth.
                          </p>
                          <details className="history comparison">
                            <summary>
                              <PencilLine size={17} /> See wording changes{" "}
                              <span>Original → current draft</span>
                            </summary>
                            <WordDiff before={bullet.original} after={active} />
                          </details>
                          {candidate && (
                            <section className="candidate card">
                              <span className="eyebrow">
                                PREVIEW · NOT YET ACCEPTED
                              </span>
                              {candidate.original === bullet.original ? (
                                <>
                                  <h3>How does this version feel?</h3>
                                  <p className="candidate-text">
                                    {candidate.rewritten}
                                  </p>
                                  <WordDiff
                                    before={active}
                                    after={candidate.rewritten}
                                    label="Preview wording changes"
                                  />
                                  <p>{candidate.rationale}</p>
                                  <div className="button-row">
                                    <button
                                      className="primary"
                                      onClick={() => {
                                        updateReport(
                                          acceptRevision(report, candidate),
                                        );
                                        clearPending();
                                        setManual(null);
                                        setNotice(
                                          "Draft accepted. Previous versions remain in your history.",
                                        );
                                      }}
                                    >
                                      <Check size={16} /> Use this draft
                                    </button>
                                    <button
                                      className="secondary"
                                      onClick={clearPending}
                                    >
                                      Keep current draft
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p>
                                    Another bullet has a preview waiting. Accept
                                    or dismiss it before generating another.
                                  </p>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      openBullet(
                                        report.analysis.bullet_rewrites.findIndex(
                                          (b) =>
                                            b.original === candidate.original,
                                        ),
                                      )
                                    }
                                  >
                                    Go to that preview <ArrowRight size={15} />
                                  </button>
                                </>
                              )}
                            </section>
                          )}
                          <section className="card refinement-card">
                            <div className="card-title">
                              <Sparkles size={19} />
                              <h3>Give it a final polish</h3>
                              <span>
                                {Math.max(0, 5 - report.previewCount)} previews
                                left
                              </span>
                            </div>
                            {isDemo ? (
                              <div className="field">
                                <label htmlFor="demo-style">
                                  Fictional sample style
                                </label>
                                <select
                                  id="demo-style"
                                  value={style}
                                  onChange={(e) => setStyle(e.target.value)}
                                >
                                  <option>Concise</option>
                                  <option>Action-focused</option>
                                </select>
                                <p className="helper">
                                  Authored sample revisions. No API requests.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="style-suggestions">
                                  {[
                                    "More concise",
                                    "Lead with action",
                                    "Plain language",
                                  ].map((s) => (
                                    <button
                                      key={s}
                                      className="secondary"
                                      onClick={() =>
                                        setFeedback(
                                          `${s}, while preserving the original facts and scope.`,
                                        )
                                      }
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                                <div className="field">
                                  <label htmlFor="feedback">
                                    What would you like to change?
                                  </label>
                                  <textarea
                                    id="feedback"
                                    value={feedback}
                                    maxLength={1500}
                                    onChange={(e) =>
                                      setFeedback(e.target.value)
                                    }
                                    placeholder="For example: Make this shorter and lead with the action."
                                  />
                                </div>
                                <p className="helper">
                                  Feedback changes wording only. Add new facts
                                  to your resume and update the review.
                                </p>
                              </>
                            )}
                            <button
                              className="primary"
                              disabled={
                                !!busy ||
                                !!candidate ||
                                report.previewCount >= 5 ||
                                stale ||
                                (!isDemo &&
                                  (!consent ||
                                    feedback.trim().length < 10 ||
                                    !liveEnabled ||
                                    !accessCode))
                              }
                              onClick={() => void refine()}
                            >
                              {busy ? (
                                <LoaderCircle className="spin" size={16} />
                              ) : (
                                <Sparkles size={16} />
                              )}{" "}
                              Preview refinement
                            </button>
                            <p className="helper">
                              {stale
                                ? "Update or restore the reviewed inputs before generating."
                                : report.previewCount >= 5
                                  ? "Preview allowance used. You can still edit, restore, copy, and download."
                                  : "Your current draft stays unchanged until you accept a preview."}
                            </p>
                          </section>
                          <details className="history">
                            <summary>
                              <RotateCcw size={17} /> Version history{" "}
                              <span>
                                {
                                  report.revisions.filter(
                                    (r) => r.original === bullet.original,
                                  ).length
                                }{" "}
                                accepted revisions
                              </span>
                            </summary>
                            {[
                              { ...bullet, rationale: "Initial suggestion" },
                              ...report.revisions.filter(
                                (r) => r.original === bullet.original,
                              ),
                            ].map((r, i) => (
                              <article key={`${i}-${r.rewritten}`}>
                                <span className="eyebrow">
                                  {i === 0
                                    ? "INITIAL SUGGESTION"
                                    : `ACCEPTED REVISION ${i}`}
                                </span>
                                <p>{r.rewritten}</p>
                                <button
                                  className="text-button"
                                  disabled={active === r.rewritten}
                                  onClick={() => {
                                    updateReport(
                                      restoreRevision(
                                        report,
                                        bullet.original,
                                        r.rewritten,
                                      ),
                                    );
                                    setNotice(
                                      "Saved version restored. No API request or preview used.",
                                    );
                                  }}
                                >
                                  <RotateCcw size={14} />
                                  {active === r.rewritten
                                    ? "Current version"
                                    : "Use this version"}
                                </button>
                              </article>
                            ))}
                          </details>
                          <details className="history">
                            <summary>
                              <PencilLine size={17} /> Edit the wording yourself
                              <span>No API request</span>
                            </summary>
                            <div className="field">
                              <label htmlFor="manual-draft">
                                Your edited draft
                              </label>
                              <textarea
                                id="manual-draft"
                                maxLength={1500}
                                value={manual ?? active}
                                onChange={(e) => setManual(e.target.value)}
                              />
                              <p className="helper">
                                Keep the facts and numbers true to the source.
                                Edits still require your judgment.
                              </p>
                              <button
                                className="secondary"
                                disabled={!!candidate}
                                onClick={() => {
                                  try {
                                    const revision = validateRevision(
                                      {
                                        original: bullet.original,
                                        rewritten: manual ?? active,
                                        rationale:
                                          "Applicant-edited wording. Verify every claim.",
                                      },
                                      report.materials.resume,
                                      bullet.original,
                                    );
                                    setPending((p) => ({
                                      ...p,
                                      [report.id]: revision,
                                    }));
                                  } catch (e) {
                                    setError(
                                      e instanceof AppError
                                        ? e.message
                                        : "Use at least 10 characters. Your current draft is unchanged.",
                                    );
                                  }
                                }}
                              >
                                Preview my edit
                              </button>
                            </div>
                          </details>
                        </>
                      )}
                    </>
                  )}
                  {view === "Action plan" && (
                    <>
                      <div className="section-intro">
                        <h2>Turn the review into your next move.</h2>
                        <p>
                          Start with the changes that make your real experience
                          easier to see. Progress is kept while this page stays
                          open.
                        </p>
                      </div>
                      <div className="action-list">
                        {report.analysis.action_plan.map((action, i) => {
                          const links = actionTargets(action, report.analysis);
                          return (
                            <article
                              className={`action-row ${tasks[`${report.id}-${i}`] ? "completed" : ""}`}
                              key={action}
                            >
                              <label
                                className={`action-item ${tasks[`${report.id}-${i}`] ? "done" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!tasks[`${report.id}-${i}`]}
                                  onChange={(event) =>
                                    setTasks((t) => ({
                                      ...t,
                                      [`${report.id}-${i}`]:
                                        event.target.checked,
                                    }))
                                  }
                                />
                                <span className="action-number">0{i + 1}</span>
                                <span>{action}</span>
                              </label>
                              <div
                                className="action-shortcuts"
                                aria-label={`Related items for action ${i + 1}`}
                              >
                                {links.requirements.map((index) => (
                                  <button
                                    className="text-button"
                                    key={`r${index}`}
                                    onClick={() => openRequirement(index)}
                                  >
                                    <Target size={14} />
                                    {
                                      report.analysis.requirements[index]
                                        .requirement
                                    }{" "}
                                    evidence
                                  </button>
                                ))}
                                {links.bullets.map((index) => (
                                  <button
                                    className="text-button"
                                    key={`b${index}`}
                                    onClick={() => openBullet(index)}
                                  >
                                    <PencilLine size={14} />
                                    Edit bullet {index + 1}
                                  </button>
                                ))}
                                {!links.requirements.length &&
                                  !links.bullets.length && (
                                    <button
                                      className="text-button"
                                      onClick={() => navigate("Match evidence")}
                                    >
                                      Review all evidence{" "}
                                      <ArrowRight size={14} />
                                    </button>
                                  )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() => navigate("Match evidence")}
                        >
                          Review evidence <ArrowRight size={15} />
                        </button>
                        <button
                          className="primary"
                          onClick={() => navigate("Bullet studio")}
                        >
                          Improve a bullet <ArrowRight size={15} />
                        </button>
                      </div>
                      <details className="history">
                        <summary>
                          <FileText size={17} /> Application readability tips
                        </summary>
                        <ul>
                          {report.analysis.ats_tips.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </details>
                      <details className="history">
                        <summary>
                          <CircleHelp size={17} /> Prepare for the interview
                        </summary>
                        <ol>
                          {report.analysis.interview_questions.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ol>
                      </details>
                    </>
                  )}
                  {view === "Export" && (
                    <>
                      <div className="section-intro">
                        <h2>Keep your next steps close.</h2>
                        <p>
                          Your evidence, current drafts, accepted revisions, and
                          action plan, ready to take with you.
                        </p>
                      </div>
                      <section className="card export-card">
                        <span className="export-icon">
                          <Download size={26} />
                        </span>
                        <div>
                          <h3>Take your review with you.</h3>
                          <p>
                            A readable text report with the versions you’ve
                            chosen. Contains quoted resume excerpts; keep your
                            download private.
                          </p>
                          <button className="primary" onClick={exportReview}>
                            <Download size={16} /> Download text report
                          </button>
                          <button
                            className="secondary"
                            onClick={() => window.print()}
                          >
                            <FileText size={16} /> Print / save PDF
                          </button>
                        </div>
                      </section>
                      <details className="history">
                        <summary>
                          <FileText size={17} /> Preview your report
                        </summary>
                        <pre className="export-preview">
                          {reportText(report)}
                        </pre>
                      </details>
                      <details className="history">
                        <summary>Advanced: structured JSON export</summary>
                        <p>
                          Includes source excerpts and drafts. The full original
                          materials and access code are excluded.
                        </p>
                        <button
                          className="secondary"
                          onClick={() =>
                            saveFile(
                              exportJson(report),
                              exportFilename(report, "json"),
                              "application/json",
                            )
                          }
                        >
                          Download JSON
                        </button>
                      </details>
                      <details className="history">
                        <summary>
                          <ShieldCheck size={17} /> Source and limitations
                        </summary>
                        <p>
                          {isDemo
                            ? "Human-authored fictional example, not a live AI result."
                            : "Generated with OpenAI. Review every claim before use."}
                        </p>
                        <ul>
                          {[...new Set(report.analysis.limitations)].map(
                            (t) => (
                              <li key={t}>{t}</li>
                            ),
                          )}
                        </ul>
                      </details>
                      <article className="print-report">
                        <pre>{reportText(report)}</pre>
                      </article>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <footer className="footer">
            <span>
              <ArrowUpRight size={15} /> RoleReady · Your experience. A clearer
              story.
            </span>
            <span>Keep every claim true to you.</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialogRef}
        onCancel={() => setConfirm(null)}
        className="confirm-dialog"
        aria-labelledby="dialog-title"
      >
        <h2 id="dialog-title">
          {confirm === "materials"
            ? "Clear your input materials?"
            : "Start a new review?"}
        </h2>
        <p>
          {confirm === "materials"
            ? "This clears the resume and job description inputs. Your previous review, accepted drafts, and connection settings stay available. You can restore reviewed inputs later."
            : "This clears your application materials and current review. Download a copy first if you want to keep it. Your access code and coaching voice stay configured."}
        </p>
        <div className="button-row">
          <button
            className="secondary"
            autoFocus
            onClick={() => setConfirm(null)}
          >
            Keep working
          </button>
          {userReport && (
            <button
              className="secondary"
              onClick={() =>
                saveFile(
                  reportText(userReport),
                  exportFilename(userReport, "txt"),
                )
              }
            >
              Download first
            </button>
          )}
          <button
            className="primary"
            onClick={confirm === "materials" ? clearMaterials : fresh}
          >
            {confirm === "materials" ? "Clear input materials" : "Start fresh"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
