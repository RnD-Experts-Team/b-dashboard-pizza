"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, ExternalLink, Loader2, Pencil, Plus, RotateCcw, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentGallery } from "@/components/maintenance-tickets/attachment-gallery";
import { GuideEditor } from "./guide-editor";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { IssueTroubleshooting as IssueTroubleshootingData, TroubleshootingGuide, TroubleshootingOutcome } from "@/types/maintenance-tickets.types";

export interface TroubleshootingResult {
  outcome: TroubleshootingOutcome;
  /** The guide they said matched -- optional. */
  guide: TroubleshootingGuide | null;
}

function times(n: number): string {
  return n === 1 ? "once" : `${n} times`;
}

/** One guide: the problem, its steps (each with its own files), then the guide's link and files. */
function GuideCard({
  guide,
  index,
  selected,
  onSelect,
  onEdit,
}: {
  guide: TroubleshootingGuide;
  index: number;
  selected: boolean;
  /** Absent when nothing can be chosen (browsing without a store). */
  onSelect?: () => void;
  onEdit?: () => void;
}) {
  return (
    <section
      aria-labelledby={`guide-${guide.id}-title`}
      className={cn(
        "rounded-xl border bg-card shadow-sm transition-colors duration-150",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Problem {index + 1}</p>
          <h3 id={`guide-${guide.id}-title`} className="font-heading text-base font-semibold leading-tight">{guide.title}</h3>
          {(guide.fixedCount > 0 || guide.notFixedCount > 0) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[
                guide.fixedCount > 0 ? `Fixed it ${times(guide.fixedCount)}` : null,
                guide.notFixedCount > 0 ? `didn't fix it ${times(guide.notFixedCount)}` : null,
              ].filter(Boolean).join(" · ").replace(/^d/, "D")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> Edit
            </Button>
          )}
          {onSelect && (
            <Button
              type="button"
              variant={selected ? "default" : "outline"}
              size="sm"
              onClick={onSelect}
              aria-pressed={selected}
            >
              {selected ? <CheckCircle2 className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
              {selected ? "My problem" : "This is my problem"}
            </Button>
          )}
        </div>
      </header>

      <ol className="divide-y">
        {guide.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap text-sm">{step.body}</p>
              <AttachmentGallery attachments={step.attachments} />
            </div>
          </li>
        ))}
      </ol>

      {(guide.linkUrl || guide.attachments.length > 0) && (
        <footer className="space-y-1 border-t bg-muted/20 px-4 py-3">
          {guide.linkUrl && (
            <a
              href={guide.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open the guide (video / manual)
            </a>
          )}
          <AttachmentGallery attachments={guide.attachments} />
        </footer>
      )}
    </section>
  );
}

/**
 * An issue's troubleshooting page: every guide for it, one per specific
 * problem, each step with its own photos and videos.
 *
 * "ticket" -- inside the new-ticket window, after the store picked the issue.
 *   It ends with one of three answers (picking the guide that matches is
 *   optional): this fixed it (logged here, no ticket), I tried these steps,
 *   or none of these describe my problem. Either of the last two lets the
 *   ticket be submitted.
 * "browse" -- the standalone page. "This fixed it" is offered when a store is
 *   selected (a fix is logged against a store); catalog managers also add,
 *   edit and remove guides here.
 */
export function IssueTroubleshooting({
  issueId,
  mode,
  storeCode,
  initialGuideId = null,
  canEdit = false,
  onResult,
}: {
  issueId: number;
  mode: "ticket" | "browse";
  /** The store a fix is logged for; null when none is selected. */
  storeCode: string | null;
  /** The guide picked on an earlier visit. */
  initialGuideId?: number | null;
  canEdit?: boolean;
  /** Called after "fixed" is logged, or with "tried" / "none_match". */
  onResult?: (result: TroubleshootingResult) => void;
}) {
  const [data, setData] = useState<IssueTroubleshootingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialGuideId);
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      setData(await maintenanceTicketsService.getIssueTroubleshooting(issueId, signal, storeCode));
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not load the troubleshooting.");
    }
  }, [issueId, storeCode]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const guides = data?.guides ?? [];
  const selected = guides.find((g) => g.id === selectedId) ?? null;
  const canPick = mode === "ticket" || !!storeCode;

  async function fixed() {
    if (!storeCode) return;
    setLogging(true);
    try {
      await maintenanceTicketsService.logTroubleshootingFix(storeCode, issueId, selected?.id ?? null);
      if (mode === "browse") {
        toast.success("Logged as fixed by troubleshooting. Glad it works again.");
        setSelectedId(null);
        void load();
      }
      onResult?.({ outcome: "fixed", guide: selected });
    } catch (err) {
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not log the fix. Try again.");
    } finally {
      setLogging(false);
    }
  }

  function replaceGuide(next: TroubleshootingGuide) {
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.guides.some((g) => g.id === next.id);
      const guidesNext = exists ? prev.guides.map((g) => (g.id === next.id ? next : g)) : [...prev.guides, next];
      return { ...prev, guides: [...guidesNext].sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id) };
    });
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading the troubleshooting">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Wrench className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold leading-tight">
            {data.title}
            <span className="ms-2 align-middle text-sm font-normal text-muted-foreground">
              {guides.length === 1 ? "1 guide" : `${guides.length} guides`}
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mode === "ticket"
              ? "Before opening a ticket, try the steps for your problem. Picking the problem that matches is optional."
              : data.description || "What to try before opening a ticket for this issue."}
          </p>
        </div>
        {canEdit && editing === null && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> Add a guide
          </Button>
        )}
      </div>

      {editing === "new" && (
        <GuideEditor
          issueId={data.issueId}
          issueTitle={data.title}
          guide={null}
          onSaved={(g) => { replaceGuide(g); setEditing(g.id); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {guides.length === 0 && editing === null && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
          <CircleHelp className="h-6 w-6 text-muted-foreground/70" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {canEdit ? "No guides for this issue yet. Add one for each problem stores run into." : "There are no troubleshooting steps for this issue."}
          </p>
        </div>
      )}

      {guides.map((guide, i) =>
        editing === guide.id ? (
          <GuideEditor
            key={guide.id}
            issueId={data.issueId}
            issueTitle={data.title}
            guide={guide}
            onSaved={replaceGuide}
            onRemoved={() => {
              setData((prev) => (prev ? { ...prev, guides: prev.guides.filter((g) => g.id !== guide.id) } : prev));
              if (selectedId === guide.id) setSelectedId(null);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <GuideCard
            key={guide.id}
            guide={guide}
            index={i}
            selected={guide.id === selectedId}
            onSelect={canPick ? () => setSelectedId((cur) => (cur === guide.id ? null : guide.id)) : undefined}
            onEdit={canEdit && editing === null ? () => setEditing(guide.id) : undefined}
          />
        ),
      )}

      {mode === "ticket" && (
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {selected ? <>How did the &ldquo;{selected.title}&rdquo; steps go?</> : "How did it go?"}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              className="h-auto min-h-11 whitespace-normal bg-emerald-600 py-2 text-white hover:bg-emerald-700"
              onClick={() => void fixed()}
              disabled={logging || !storeCode}
            >
              {logging ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="me-1.5 h-4 w-4" aria-hidden="true" />}
              This fixed it
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal py-2"
              onClick={() => onResult?.({ outcome: "tried", guide: selected })}
              disabled={logging}
            >
              <XCircle className="me-1.5 h-4 w-4" aria-hidden="true" />
              I tried these steps — still broken
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal py-2"
              onClick={() => onResult?.({ outcome: "none_match", guide: null })}
              disabled={logging}
            >
              <CircleHelp className="me-1.5 h-4 w-4" aria-hidden="true" />
              None of these describe my problem
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            &ldquo;This fixed it&rdquo; is logged and no ticket is opened for this issue. The other two take you back to the ticket.
          </p>
        </div>
      )}

      {mode === "browse" && guides.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4">
          <p className="min-w-0 flex-1 text-sm">
            {storeCode
              ? <>Did a guide fix it at {storeCode}? Log it, so we know the steps work{selected ? <> (&ldquo;{selected.title}&rdquo;)</> : null}.</>
              : "Select a store at the top of the page to log a problem these steps fixed."}
          </p>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void fixed()}
            disabled={logging || !storeCode}
          >
            {logging ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="me-1.5 h-4 w-4" aria-hidden="true" />}
            This fixed it
          </Button>
        </div>
      )}
    </div>
  );
}
