"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolveSection, type Candidate } from "@/lib/report-problem/candidates";
import { CaptureError, captureElement, preloadCapture, type CaptureResult } from "@/lib/report-problem/capture";
import { resolvePage, type ReportPage } from "@/lib/report-problem/pages";
import { useReportProblem, type ReportTarget } from "@/lib/store/report-problem.store";
import { InspectOverlay } from "./inspect-overlay";
import { ReportProblemDialog } from "./report-problem-dialog";

/* ────────────────────────────────────────────────────────────────────────── */
/*  "Report a problem" — mounted once inside the dashboard layout. Renders   */
/*  nothing until a trigger starts a report; then the inspect overlay, then  */
/*  the dialog. Both portal to <body>, outside the app shell's tree.         */
/* ────────────────────────────────────────────────────────────────────────── */

/** Lets the frozen highlight + "Capturing…" chip paint before the (synchronous) clone. */
const PAINT_DELAY_MS = 32;
/** A stalled library chunk must not hold the full-screen catcher forever. */
const LOAD_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new CaptureError("timeout")), ms);
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function ReportProblemRoot({ pageOverride }: { pageOverride?: ReportPage } = {}) {
  const phase = useReportProblem((s) => s.phase);
  const pathname = usePathname();
  const page = useMemo(() => pageOverride ?? resolvePage(pathname), [pageOverride, pathname]);
  const mode = page.mode ?? "general";

  // `?reportDebug=1` labels every candidate with its kind and id.
  const debug = phase === "inspecting" && new URLSearchParams(window.location.search).has("reportDebug");
  useEffect(() => {
    // Load the screenshot library now, so the clone can run the moment a part is picked.
    if (phase === "inspecting") void preloadCapture().catch(() => undefined);
  }, [phase]);

  // Navigating away mid-pick abandons it (a dialog in progress stays open).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const s = useReportProblem.getState();
    if (s.phase === "inspecting" || s.phase === "capturing") s.cancel();
  }, [pathname]);

  const handleChoose = useCallback(
    async (c: Candidate) => {
      const store = useReportProblem.getState();
      if (store.phase !== "inspecting") return;

      const section = resolveSection(c, page);
      const target: ReportTarget = {
        kind: c.kind,
        label: c.label,
        contents: c.contents,
        wholePage: c.wholePage,
        id: c.id,
        sectionKey: section.key,
        sectionSource: section.source,
        pageLabelKey: page.labelKey,
        pathname,
        search: window.location.search,
        mode,
        pickedAt: Date.now(),
      };
      const id = store.beginCapture(target);
      // Every await below can be overtaken by a cancel (Esc, a resize, a
      // route change) — re-check before each step so a cancelled pick never
      // opens the dialog.
      const stillOurs = () => {
        const s = useReportProblem.getState();
        return s.captureId === id && s.phase === "capturing";
      };

      await new Promise((r) => window.setTimeout(r, PAINT_DELAY_MS));
      if (!stillOurs()) return;

      let pending: Promise<CaptureResult>;
      try {
        const h2c = await withTimeout(preloadCapture(), LOAD_TIMEOUT_MS);
        if (!stillOurs()) return;
        // The clone is taken synchronously inside this call — before the
        // dialog opens and Radix touches <body>.
        pending = captureElement(c.el as HTMLElement, h2c, { kind: c.kind });
      } catch (err) {
        if (!stillOurs()) return;
        pending = Promise.reject(err);
      }
      useReportProblem.getState().openDialog();
      pending.then(
        (result) => useReportProblem.getState().finishCapture(id, { result }),
        (err) =>
          useReportProblem
            .getState()
            .finishCapture(id, { error: err instanceof CaptureError ? err.reason : "failed" }),
      );
    },
    [page, mode, pathname],
  );

  const cancel = useCallback(() => useReportProblem.getState().cancel(), []);

  if (phase === "inspecting" || phase === "capturing") {
    return (
      <InspectOverlay
        mode={mode}
        capturing={phase === "capturing"}
        onChoose={(c) => void handleChoose(c)}
        onCancel={cancel}
        debug={debug}
      />
    );
  }
  if (phase === "dialog") return <ReportProblemDialog page={page} />;
  return null;
}
