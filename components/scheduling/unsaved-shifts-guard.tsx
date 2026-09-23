"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TriangleAlert } from "lucide-react";

/**
 * Warns before an action that moves away from drafted shifts.
 *
 * There is no precedent for this in the repo — no `beforeunload` handler exists
 * anywhere, and App Router has no `router.events` to hook. So this covers the
 * three routes out:
 *
 *   1. Actions we own (week nav, mode toggle) — wrapped via `requestAction`.
 *   2. In-app navigation — a capture-phase document click listener catches
 *      internal `<a href>` clicks before Next's router sees them. Both the
 *      sidebar and bottom-nav use plain `<Link>`, so this reaches them without
 *      editing Core layout files.
 *   3. Tab close / reload — `beforeunload`. The browser shows its own generic
 *      wording here; that text cannot be customised.
 *
 * IMPORTANT ON WORDING: drafts are persisted per store and week, so none of
 * these actions actually destroys them — leaving parks them and coming back
 * restores them. The copy says the shifts are "not scheduled yet" rather than
 * "will be lost", because saying "lost" when nothing is lost teaches managers to
 * click through the warning. The existing `dashboard.discardChanges` i18n keys
 * are deliberately NOT reused for the same reason: they say "discard".
 */

interface UseUnsavedShiftsGuardOptions {
  hasDrafts: boolean;
  draftCount: number;
}

type PendingKind = "action" | "navigation";

export interface UnsavedShiftsDialogProps {
  open: boolean;
  draftCount: number;
  kind: PendingKind;
  onConfirm: () => void;
  onCancel: () => void;
}

export function useUnsavedShiftsGuard({
  hasDrafts,
  draftCount,
}: UseUnsavedShiftsGuardOptions) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    kind: PendingKind;
    run: () => void;
  } | null>(null);

  // Read inside listeners without re-attaching them on every count change.
  const hasDraftsRef = useRef(hasDrafts);
  hasDraftsRef.current = hasDrafts;

  /** Wrap an action that would move away from the drafted week. */
  const requestAction = useCallback(
    (run: () => void) => {
      if (!hasDraftsRef.current) {
        run();
        return;
      }
      setPending({ kind: "action", run });
    },
    [],
  );

  // ── Tab close / reload ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasDrafts) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for the prompt to show in some browsers. The message itself is
      // ignored — every modern browser shows its own generic text.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDrafts]);

  // ── In-app navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hasDrafts) return;

    const onClick = (e: MouseEvent) => {
      if (!hasDraftsRef.current) return;
      // Let modified clicks through — the user is opening a new tab, so this
      // page (and its drafts) stays exactly where it is.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      if (e.button !== 0) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // External links and downloads leave the SPA anyway; beforeunload covers them.
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page — nothing is being left.
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();

      const target = url.pathname + url.search;
      setPending({ kind: "navigation", run: () => router.push(target) });
    };

    // Capture phase, so this runs before Next's own Link handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hasDrafts, router]);

  const confirm = useCallback(() => {
    const run = pending?.run;
    setPending(null);
    run?.();
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  return {
    requestAction,
    dialogProps: {
      open: pending !== null,
      draftCount,
      kind: pending?.kind ?? "action",
      onConfirm: confirm,
      onCancel: cancel,
    } satisfies UnsavedShiftsDialogProps,
  };
}

export function UnsavedShiftsDialog({
  open,
  draftCount,
  kind,
  onConfirm,
  onCancel,
}: UnsavedShiftsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            {draftCount} shift{draftCount !== 1 ? "s" : ""} not scheduled yet
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You have {draftCount} shift{draftCount !== 1 ? "s" : ""} on screen
                that {draftCount !== 1 ? "have" : "has"} not been saved, so staff
                cannot see {draftCount !== 1 ? "them" : "it"} yet.
              </p>
              <p className="text-xs">
                {kind === "navigation"
                  ? "Your work is kept as a draft — it will still be here when you come back to this week."
                  : "Your work is kept as a draft for this week and will be here when you return to it."}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay and save</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {kind === "navigation" ? "Leave anyway" : "Continue anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
