"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { announcementService } from "@/lib/api/services/announcement.service";
import {
  parseAnnouncementError,
  type AnnouncementError,
} from "@/lib/announcements/errors";
import {
  buildCreatePayload,
  buildUpdatePayload,
  emptyFormState,
  formStateFromAnnouncement,
  isBodyEmpty,
  isEmptyPayload,
  isWindowValid,
  localInputToIso,
  type AnnouncementFormState,
} from "@/lib/announcements/payload";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import type { Announcement } from "@/types/announcement.types";
import { AnnouncementErrorAlert } from "../shared/announcement-error-alert";
import { useMediaQuery } from "../shared/use-media-query";
import {
  FIELD_ORDER,
  buildDraftPost,
  fieldsTouchedBy,
  firstErrorField,
  messageForField,
  unplacedFields,
  type ComposerField,
} from "./composer-draft";
import { ComposerForm, type ComposerErrors } from "./composer-form";
import { ComposerPreview } from "./composer-preview";

export type ComposerMode = "create" | "edit";

export interface AnnouncementComposerDialogProps {
  mode: ComposerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode: the announcement to load and change. */
  announcementId?: number | null;
  /** After a successful save (the dialog closes itself). */
  onSaved?: (announcement: Announcement) => void;
}

/** What the dialog needs to know to decide whether closing needs a second thought. */
interface ComposerGuard {
  /** The form differs from what was loaded, or an upload is running. */
  dirty: boolean;
  /** A file is being checked or uploaded (closing cancels it). */
  busy: boolean;
}

const WIDE_QUERY = "(min-width: 1024px)";

/**
 * ONE dialog to write a new announcement or edit an existing one.
 *
 *  - lg and up: two columns, the scrolling form and a sticky live preview (the
 *    real feed post, its accent ring turning).
 *  - Below lg: full screen, with a Write | Preview switch in the header.
 *
 * The session (form, errors, upload state) lives INSIDE the dialog content, so
 * it starts clean every time the dialog opens. Closing with unsaved changes
 * (or a running upload) asks first; the dialog's own buttons, Esc and the
 * overlay all go through that check.
 */
export function AnnouncementComposerDialog({
  mode,
  open,
  onOpenChange,
  announcementId,
  onSaved,
}: AnnouncementComposerDialogProps) {
  const tc = useTranslations("announcements.composer");
  const wide = useMediaQuery(WIDE_QUERY);

  const contentRef = useRef<HTMLDivElement>(null);
  const guardRef = useRef<ComposerGuard>({ dirty: false, busy: false });
  const [confirm, setConfirm] = useState({ open: false, busy: false });

  const onGuardChange = useCallback((guard: ComposerGuard) => {
    guardRef.current = guard;
  }, []);

  const requestClose = useCallback(() => {
    const guard = guardRef.current;
    if (guard.dirty || guard.busy) {
      setConfirm({ open: true, busy: guard.busy });
      return;
    }
    onOpenChange(false);
  }, [onOpenChange]);

  const closeNow = useCallback(() => onOpenChange(false), [onOpenChange]);

  const discard = () => {
    // Leaving unmounts the media field, which cancels a running upload.
    setConfirm((c) => ({ ...c, open: false }));
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <DialogContent
          ref={contentRef}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // A new announcement on a wide screen starts in the title; elsewhere
            // (a phone would pop its keyboard, edit is still loading) the dialog itself.
            const title =
              wide && mode === "create"
                ? contentRef.current?.querySelector<HTMLInputElement>('[data-field="title"] input')
                : null;
            (title ?? contentRef.current)?.focus({ preventScroll: true });
          }}
          className={cn(
            "flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:max-w-none",
            "lg:h-[min(52rem,calc(100dvh-3rem))] lg:w-[min(74rem,calc(100vw-3rem))] lg:rounded-xl lg:border lg:shadow-lg",
          )}
        >
          <ComposerSession
            mode={mode}
            announcementId={announcementId}
            wide={wide}
            onGuardChange={onGuardChange}
            onRequestClose={requestClose}
            onClose={closeNow}
            onSaved={onSaved}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm.open}
        onOpenChange={(next) => {
          if (!next) setConfirm((c) => ({ ...c, open: false }));
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc("discard.description")}
              {confirm.busy ? ` ${tc("discard.uploadNote")}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("discard.keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={discard}
            >
              {tc("discard.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The session                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface ComposerSessionProps {
  mode: ComposerMode;
  announcementId: number | null | undefined;
  wide: boolean;
  onGuardChange: (guard: ComposerGuard) => void;
  onRequestClose: () => void;
  onClose: () => void;
  onSaved?: (announcement: Announcement) => void;
}

type LoadStatus = "loading" | "ready" | "error";

function ComposerSession({
  mode,
  announcementId,
  wide,
  onGuardChange,
  onRequestClose,
  onClose,
  onSaved,
}: ComposerSessionProps) {
  const tc = useTranslations("announcements.composer");
  const reduceMotion = useReducedMotion();

  const createAnnouncement = useAnnouncementStore((s) => s.createAnnouncement);
  const updateAnnouncement = useAnnouncementStore((s) => s.updateAnnouncement);

  /* ── Loading (edit) ─────────────────────────────────────────────────── */
  const [original, setOriginal] = useState<Announcement | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(mode === "edit" ? "loading" : "ready");
  const [loadError, setLoadError] = useState<AnnouncementError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<AnnouncementFormState>(emptyFormState);
  const [baseline, setBaseline] = useState<AnnouncementFormState>(emptyFormState);

  useEffect(() => {
    if (mode !== "edit" || announcementId == null) return;
    const controller = new AbortController();
    announcementService
      .getAnnouncement(announcementId, controller.signal)
      .then((loaded) => {
        const state = formStateFromAnnouncement(loaded);
        setOriginal(loaded);
        setForm(state);
        setBaseline(state);
        setLoadStatus("ready");
      })
      .catch((err: unknown) => {
        const error = parseAnnouncementError(err, tc("loadError"));
        if (error.kind === "cancelled") return;
        setLoadError(error);
        setLoadStatus("error");
      });
    return () => controller.abort();
  }, [mode, announcementId, reloadKey, tc]);

  const retryLoad = () => {
    setLoadStatus("loading");
    setLoadError(null);
    setReloadKey((n) => n + 1);
  };

  /* ── Form, upload and errors ────────────────────────────────────────── */
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<AnnouncementError | null>(null);
  const [clientErrors, setClientErrors] = useState<ComposerErrors>({});
  /** Fields edited since the last save attempt: their old errors no longer apply. */
  const [dismissed, setDismissed] = useState<ReadonlySet<ComposerField>>(new Set());
  const [tab, setTab] = useState<"write" | "preview">("write");

  const change = useCallback((patch: Partial<AnnouncementFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    const touched = fieldsTouchedBy(patch);
    if (touched.length === 0) return;
    setDismissed((prev) =>
      touched.every((field) => prev.has(field)) ? prev : new Set([...prev, ...touched]),
    );
  }, []);

  const dirty = loadStatus === "ready" && (busy || JSON.stringify(form) !== JSON.stringify(baseline));

  useEffect(() => {
    onGuardChange({ dirty, busy });
  }, [dirty, busy, onGuardChange]);
  useEffect(() => () => onGuardChange({ dirty: false, busy: false }), [onGuardChange]);

  const errors = useMemo<ComposerErrors>(() => {
    const out: ComposerErrors = {};
    for (const field of FIELD_ORDER) {
      if (dismissed.has(field)) continue;
      const message = clientErrors[field] ?? messageForField(submitError, field);
      if (message) out[field] = message;
    }
    return out;
  }, [clientErrors, submitError, dismissed]);

  const windowWarning = isWindowValid(localInputToIso(form.startsAt), localInputToIso(form.endsAt))
    ? null
    : tc("errors.windowInvalid");

  /* ── Scroll to (and focus) the first field with a problem ───────────── */
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<{ field: ComposerField; n: number } | null>(null);

  useEffect(() => {
    if (!scrollTarget) return;
    // The form is hidden behind the Preview tab on a phone: show it first, then run again.
    if (!wide && tab !== "write") {
      setTab("write");
      return;
    }
    const el = formScrollRef.current?.querySelector<HTMLElement>(
      `[data-field="${scrollTarget.field}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      el.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), [contenteditable="true"], button:not(:disabled), [tabindex="0"]',
      )?.focus({ preventScroll: true });
    }
    setScrollTarget(null);
  }, [scrollTarget, wide, tab, reduceMotion]);

  const showFirstProblem = (field: ComposerField | null) => {
    if (field) setScrollTarget((prev) => ({ field, n: (prev?.n ?? 0) + 1 }));
  };

  /* ── Save ───────────────────────────────────────────────────────────── */
  const submit = async () => {
    if (saving || busy || loadStatus !== "ready") return;

    setSubmitError(null);
    setDismissed(new Set());

    // The two things the server would refuse for sure get an inline message first.
    const problems: ComposerErrors = {};
    if (!form.title.trim()) problems.title = tc("errors.titleRequired");
    if (isBodyEmpty(form.body)) problems.body = tc("errors.bodyRequired");
    setClientErrors(problems);
    const firstClient = FIELD_ORDER.find((field) => problems[field]);
    if (firstClient) {
      showFirstProblem(firstClient);
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createAnnouncement(buildCreatePayload(form));
        if (!result.ok) {
          setSubmitError(result.error);
          showFirstProblem(firstErrorField(Object.keys(result.error.fieldErrors)));
          return;
        }
        toast.success(tc("toasts.created"));
        onSaved?.(result.announcement);
        onClose();
        return;
      }

      if (!original) return;
      const payload = buildUpdatePayload(original, form);
      if (isEmptyPayload(payload)) {
        toast.info(tc("toasts.noChanges"));
        onClose();
        return;
      }
      const result = await updateAnnouncement(original.id, payload);
      if (!result.ok) {
        setSubmitError(result.error);
        showFirstProblem(firstErrorField(Object.keys(result.error.fieldErrors)));
        return;
      }
      toast.success(tc("toasts.updated"));
      onSaved?.(result.announcement);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  };

  /* ── Preview ────────────────────────────────────────────────────────── */
  const [createdAt] = useState(() => new Date().toISOString());
  const bodyEmpty = isBodyEmpty(form.body);
  const draft = useMemo(
    () =>
      loadStatus === "ready"
        ? buildDraftPost(
            form,
            original,
            createdAt,
            { untitled: tc("preview.untitled"), emptyBody: tc("preview.emptyBody") },
            bodyEmpty,
          )
        : null,
    [loadStatus, form, original, createdAt, bodyEmpty, tc],
  );

  const unplaced = unplacedFields(submitError);
  const ready = loadStatus === "ready";
  const saveLabel = busy
    ? tc("actions.waitingUpload")
    : saving
      ? mode === "create"
        ? tc("actions.posting")
        : tc("actions.saving")
      : mode === "create"
        ? tc("actions.post")
        : tc("actions.save");

  const showForm = wide || tab === "write";
  const showPreview = wide || tab === "preview";

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-base">
            {mode === "create" ? tc("createTitle") : tc("editTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">{tc("description")}</DialogDescription>
        </div>

        {!wide && (
          <Tabs value={tab} onValueChange={(value) => setTab(value as "write" | "preview")}>
            <TabsList className="h-8">
              <TabsTrigger value="write" className="px-3 text-xs">
                {tc("write")}
              </TabsTrigger>
              <TabsTrigger value="preview" className="px-3 text-xs">
                {tc("preview.tab")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon-sm" className="-me-1.5 shrink-0">
            <X aria-hidden />
            <span className="sr-only">{tc("close")}</span>
          </Button>
        </DialogClose>
      </div>

      {/* Body: form | preview */}
      <div
        className={cn(
          "min-h-0 flex-1",
          wide ? "grid grid-cols-[minmax(0,1fr)_minmax(0,26rem)] grid-rows-[minmax(0,1fr)]" : "flex flex-col",
        )}
      >
        <div
          ref={formScrollRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6",
            !showForm && "hidden",
          )}
        >
          {loadStatus === "loading" && <FormSkeleton label={tc("loading")} />}

          {loadStatus === "error" && (
            <AnnouncementErrorAlert
              error={loadError}
              title={tc("loadError")}
              onRetry={retryLoad}
            />
          )}

          {ready && (
            <ComposerForm
              form={form}
              onChange={change}
              original={original}
              errors={errors}
              windowWarning={windowWarning}
              disabled={saving}
              onMediaBusyChange={setBusy}
            />
          )}
        </div>

        {showPreview && (
          <aside
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 p-4 sm:p-6",
              wide && "border-s",
            )}
          >
            <ComposerPreview draft={draft} />
          </aside>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t bg-background">
        {submitError && (
          <div className="max-h-36 overflow-y-auto px-4 pt-3 sm:px-6">
            <AnnouncementErrorAlert
              error={submitError}
              title={tc("errors.saveFailed")}
              hideFields={unplaced.length === 0}
              onDismiss={() => setSubmitError(null)}
              compact
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onRequestClose}>
            {tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!ready || saving || busy}
            className="min-w-32 gap-1.5"
          >
            {(saving || busy) && (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
            )}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The form's shape while an announcement loads for editing. */
function FormSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="size-9 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
