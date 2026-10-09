import { create } from "zustand";
import type { TargetKind } from "@/lib/report-problem/attributes";
import type { SectionSource } from "@/lib/report-problem/candidates";
import type { CaptureFailure, CaptureResult } from "@/lib/report-problem/capture";
import type { PickMode } from "@/lib/report-problem/pages";
import type { ParticipantRole } from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  "Report a problem" session state. Not persisted — a report is one short  */
/*  interaction. Only the overlay, the dialog and the trigger subscribe, so  */
/*  nothing in the app shell or the page re-renders because of it.          */
/* ────────────────────────────────────────────────────────────────────────── */

export type ReportPhase = "idle" | "inspecting" | "capturing" | "dialog";

/** Everything the dialog and the note need about the pick — no DOM nodes. */
export interface ReportTarget {
  kind: TargetKind;
  label: string;
  /** Card names inside a section that has no title of its own. */
  contents: string[];
  wholePage: boolean;
  id: string | null;
  sectionKey: string;
  sectionSource: SectionSource;
  pageLabelKey: string;
  pathname: string;
  search: string;
  mode: PickMode;
  pickedAt: number;
}

export type ShotStatus = "capturing" | "ready" | "failed";

export interface ReportShot {
  status: ShotStatus;
  result: CaptureResult | null;
  error: CaptureFailure | null;
  /** The user chose not to send it (kept so they can add it back). */
  removed: boolean;
}

export interface ReportDraft {
  title: string;
  titleTouched: boolean;
  description: string;
  sectionKey: string;
  sectionTouched: boolean;
  storeCode: string;
  files: File[];
  participants: { user: { id: number; name: string | null } | null; role: ParticipantRole }[];
}

interface ReportProblemState {
  phase: ReportPhase;
  target: ReportTarget | null;
  shot: ReportShot | null;
  draft: ReportDraft | null;
  /** True while re-picking from the dialog — cancelling returns to it. */
  retaking: boolean;
  /**
   * The pick a retake replaces, kept until the new capture lands — so a
   * cancel mid-retake (Esc, a resize, a route change) puts it all back.
   */
  backup: { target: ReportTarget; shot: ReportShot | null } | null;
  /** Increments per capture so a late result can't land on a newer pick. */
  captureId: number;

  start: () => void;
  cancel: () => void;
  beginCapture: (target: ReportTarget) => number;
  openDialog: () => void;
  finishCapture: (id: number, outcome: { result: CaptureResult } | { error: CaptureFailure }) => void;
  setShotRemoved: (removed: boolean) => void;
  retake: () => void;
  setDraft: (patch: Partial<ReportDraft>) => void;
  close: () => void;
}

function revoke(shot: ReportShot | null | undefined) {
  if (shot?.result?.previewUrl) URL.revokeObjectURL(shot.result.previewUrl);
}

const IDLE = { phase: "idle" as const, target: null, shot: null, draft: null, retaking: false, backup: null };

export const useReportProblem = create<ReportProblemState>((set, get) => ({
  ...IDLE,
  captureId: 0,

  start: () => {
    if (get().phase !== "idle") return;
    set({ phase: "inspecting", retaking: false, backup: null });
  },

  cancel: () => {
    const { phase, retaking, target, backup, shot, captureId } = get();
    if (phase === "idle" || phase === "dialog") return;
    // Any capture still running is now stale — its result must not land.
    const next = captureId + 1;
    // Cancelling a RE-pick goes back to the report as it was.
    if (backup) {
      revoke(shot);
      set({ phase: "dialog", target: backup.target, shot: backup.shot, backup: null, retaking: false, captureId: next });
      return;
    }
    if (retaking && target) {
      set({ phase: "dialog", retaking: false, captureId: next });
      return;
    }
    revoke(shot);
    set({ ...IDLE, captureId: next });
  },

  beginCapture: (target) => {
    const { captureId, retaking, target: previous, shot, backup } = get();
    const id = captureId + 1;
    set({
      phase: "capturing",
      target,
      captureId: id,
      shot: { status: "capturing", result: null, error: null, removed: false },
      // On a retake, keep the pick being replaced until the new one lands.
      backup: retaking && previous ? (backup ?? { target: previous, shot }) : null,
    });
    if (!retaking) revoke(shot);
    return id;
  },

  // Only ever from "capturing": a cancel that landed meanwhile wins.
  openDialog: () => {
    if (get().phase !== "capturing") return;
    set({ phase: "dialog", retaking: false });
  },

  finishCapture: (id, outcome) => {
    if (id !== get().captureId || get().phase === "idle") {
      // A stale capture (the user re-picked, cancelled or closed meanwhile).
      if ("result" in outcome) URL.revokeObjectURL(outcome.result.previewUrl);
      return;
    }
    // The new pick has landed — the one it replaced can go.
    revoke(get().backup?.shot);
    set({
      backup: null,
      shot:
        "result" in outcome
          ? { status: "ready", result: outcome.result, error: null, removed: false }
          : { status: "failed", result: null, error: outcome.error, removed: false },
    });
  },

  setShotRemoved: (removed) => {
    const shot = get().shot;
    if (shot) set({ shot: { ...shot, removed } });
  },

  retake: () => set({ phase: "inspecting", retaking: true }),

  setDraft: (patch) => {
    const draft = get().draft;
    set({ draft: draft ? { ...draft, ...patch } : (patch as ReportDraft) });
  },

  close: () => {
    revoke(get().shot);
    revoke(get().backup?.shot);
    set({ ...IDLE, captureId: get().captureId + 1 });
  },
}));
