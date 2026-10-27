// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workspace from "../components/workspace";
import demo from "../lib/demo.json";
let failAnalyze = false,
  failStatus = false;
let id = 0;
const calls: { path: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  failAnalyze = false;
  failStatus = false;
  calls.length = 0;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("crypto", { randomUUID: () => `test-${++id}` });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/api/status") {
        if (failStatus) throw Error("Offline");
        return Response.json({ liveEnabled: true });
      }
      if (path === "/api/extract") return Response.json({ text: demo.resume });
      const body = JSON.parse(options?.body as string);
      calls.push({ path, body });
      if (path === "/api/analyze")
        return failAnalyze
          ? Response.json(
              {
                error:
                  "Simulated unavailable request. Your old review is safe.",
              },
              { status: 502 },
            )
          : Response.json({ analysis: demo.analysis });
      const original = body.original as keyof typeof demo.variants;
      return Response.json({ revision: demo.variants[original]["Concise"] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function own() {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Review my resume" }));
  await screen.findByText("Ready for your private review");
  return user;
}
function fill() {
  fireEvent.change(screen.getByLabelText("Resume text"), {
    target: { value: demo.resume },
  });
  fireEvent.change(screen.getByLabelText("Job description"), {
    target: { value: demo.job },
  });
  fireEvent.change(screen.getByLabelText("Private review access code"), {
    target: { value: "fake-private-code" },
  });
}
async function reviewed() {
  const user = await own();
  fill();
  await user.click(screen.getByRole("checkbox", { name: /I agree to send/ }));
  await user.click(screen.getByRole("button", { name: "Analyze job match" }));
  await screen.findByText(
    "Your new review is ready. Verify every claim before using a draft.",
  );
  return user;
}
const tab = (name: string) => screen.getByRole("tab", { name });
describe("application preservation and session controls", () => {
  it("keeps entered materials while exploring the separate demo", async () => {
    const user = await own();
    fill();
    await user.click(
      screen.getByRole("button", { name: "Explore fictional demo" }),
    );
    expect(screen.queryByLabelText("Resume text")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Back to my application" }),
    );
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe(demo.resume);
    expect(
      (screen.getByLabelText("Job description") as HTMLTextAreaElement).value,
    ).toBe(demo.job);
    expect(calls).toHaveLength(0);
  });
  it("preserves the old review and accepted drafts after edits and failed re-analysis", async () => {
    const user = await reviewed();
    await user.click(tab("Bullet studio"));
    await user.click(screen.getByRole("button", { name: "More concise" }));
    expect(calls).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Preview refinement" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Use this draft" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Your materials & review settings/ }),
    );
    fireEvent.change(screen.getByLabelText("Resume text"), {
      target: { value: demo.resume + "\nUpdated fictional materials." },
    });
    expect(
      screen.getByText("Your inputs changed. This review is preserved."),
    ).toBeTruthy();
    failAnalyze = true;
    await user.click(screen.getByRole("button", { name: "Update review" }));
    await screen.findByText(
      "Simulated unavailable request. Your old review is safe.",
    );
    expect(
      within(screen.getByText("CURRENT DRAFT").closest("article")!).getByText(
        "Cleaned 500 survey responses using Python.",
      ),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Restore reviewed inputs" }),
    );
    expect(
      screen.queryByText("Your inputs changed. This review is preserved."),
    ).toBeNull();
    expect(
      within(screen.getByText("CURRENT DRAFT").closest("article")!).getByText(
        "Cleaned 500 survey responses using Python.",
      ),
    ).toBeTruthy();
  });
  it("clears only inputs and can restore them from the preserved review", async () => {
    const user = await reviewed();
    await user.click(screen.getByText("Privacy & limits"));
    await user.click(screen.getByRole("button", { name: "Clear materials" }));
    await user.click(
      screen.getByRole("button", {
        name: "Clear input materials",
      }),
    );
    expect(
      screen.getByText("Your inputs changed. This review is preserved."),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Restore reviewed inputs" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Your materials & review settings/ }),
    );
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe(demo.resume);
    expect(
      (screen.getByLabelText("Private review access code") as HTMLInputElement)
        .value,
    ).toBe("fake-private-code");
  });
  it("new review requires confirmation and retains connection settings and coaching voice", async () => {
    const user = await own();
    fill();
    await user.selectOptions(
      screen.getByLabelText("Coaching voice"),
      "Direct resume editor",
    );
    await user.click(screen.getByRole("button", { name: "New review" }));
    await user.click(screen.getByRole("button", { name: "Keep working" }));
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe(demo.resume);
    await user.click(screen.getByRole("button", { name: "New review" }));
    await user.click(screen.getByRole("button", { name: "Start fresh" }));
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Private review access code") as HTMLInputElement)
        .value,
    ).toBe("fake-private-code");
    expect(
      (screen.getByLabelText("Coaching voice") as HTMLSelectElement).value,
    ).toBe("Direct resume editor");
  });
  it("removes the access code without erasing materials or reviews", async () => {
    const user = await reviewed();
    await user.click(screen.getByText("Privacy & limits"));
    await user.click(
      screen.getByRole("button", { name: "Remove access code" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Your materials & review settings/ }),
    );
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe(demo.resume);
    expect(
      (screen.getByLabelText("Private review access code") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(
      screen.getByRole("button", { name: "Download review" }),
    ).toBeTruthy();
  });
});
describe("onboarding and keyboard navigation", () => {
  it("upload mode has no empty extraction preview until a file is parsed", async () => {
    const user = await own();
    await user.click(screen.getByRole("radio", { name: "Upload a file" }));
    expect(screen.queryByRole("textbox", { name: "Resume text" })).toBeNull();
    const input = screen.getByLabelText("Choose PDF or DOCX");
    await user.upload(
      input,
      new File(["fictional document"], "resume.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    const preview = await screen.findByLabelText("Check extracted text");
    expect((preview as HTMLTextAreaElement).value).toBe(demo.resume);
    expect(screen.getByText("resume.docx · Text extracted")).toBeTruthy();
  });
  it("shows actionable field validation before a request is sent", async () => {
    const user = await own();
    await user.click(screen.getByLabelText("Resume text"));
    fireEvent.change(screen.getByLabelText("Resume text"), {
      target: { value: "Too short" },
    });
    await user.click(screen.getByLabelText("Job description"));
    expect(screen.getByText(/Resume needs more detail/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Analyze job match",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(calls).toHaveLength(0);
  });
  it("supports arrow, Home, and End navigation through actual tabs", async () => {
    const user = await reviewed();
    tab("Overview").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Match evidence").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Match evidence"));
    await user.keyboard("{End}");
    expect(tab("Export").getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Home}");
    expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
  });
  it("can retry a failed setup status check without losing inputs", async () => {
    failStatus = true;
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole("button", { name: "Review my resume" }));
    await screen.findByText("We couldn’t check live availability");
    fireEvent.change(screen.getByLabelText("Resume text"), {
      target: { value: demo.resume },
    });
    failStatus = false;
    await user.click(
      screen.getByRole("button", { name: "Retry availability" }),
    );
    await screen.findByText("Ready for your private review");
    expect(
      (screen.getByLabelText("Resume text") as HTMLTextAreaElement).value,
    ).toBe(demo.resume);
  });
});
describe("bullet choices and targeted next steps", () => {
  it("shows a preview without replacement, accepts explicitly, and restores a saved version", async () => {
    const user = await reviewed();
    await user.click(tab("Bullet studio"));
    await user.click(screen.getByRole("button", { name: "More concise" }));
    await user.click(
      screen.getByRole("button", { name: "Preview refinement" }),
    );
    await screen.findByRole("button", { name: "Use this draft" });
    const current = screen.getByText("CURRENT DRAFT").closest("article")!;
    expect(
      within(current).getByText(
        "Cleaned 500 survey responses with a Python script.",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use this draft" }));
    expect(
      within(current).getByText("Cleaned 500 survey responses using Python."),
    ).toBeTruthy();
    await user.click(screen.getByText("Version history"));
    await user.click(screen.getByRole("button", { name: "Use this version" }));
    expect(
      within(current).getByText(
        "Cleaned 500 survey responses with a Python script.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("4 previews left")).toBeTruthy();
  });
  it("does not count a dismissed duplicate preview twice", async () => {
    const user = await reviewed();
    await user.click(tab("Bullet studio"));
    await user.click(screen.getByRole("button", { name: "More concise" }));
    await user.click(
      screen.getByRole("button", { name: "Preview refinement" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Keep current draft" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Preview refinement" }),
    );
    await screen.findByRole("button", { name: "Use this draft" });
    expect(screen.getByText("4 previews left")).toBeTruthy();
  });
  it("previews manual edits with safe validation and no network request", async () => {
    const user = await reviewed();
    await user.click(tab("Bullet studio"));
    await user.click(screen.getByText("Edit the wording yourself"));
    fireEvent.change(screen.getByLabelText("Your edited draft"), {
      target: { value: "Cleaned 500 survey responses using Python." },
    });
    await user.click(screen.getByRole("button", { name: "Preview my edit" }));
    await user.click(screen.getByRole("button", { name: "Use this draft" }));
    expect(calls).toHaveLength(1);
    expect(screen.getByText("5 previews left")).toBeTruthy();
  });
  it("opens the exact evidence named by an action item and retains checked progress", async () => {
    const user = await reviewed();
    await user.click(tab("Action plan"));
    await user.click(
      screen.getByRole("checkbox", { name: /Clarify stakeholder/ }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Stakeholder communication evidence",
      }),
    );
    expect(tab("Match evidence").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("requirement-3")?.hasAttribute("open")).toBe(
      true,
    );
    await user.click(tab("Action plan"));
    expect(
      (
        screen.getByRole("checkbox", {
          name: /Clarify stakeholder/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });
});
