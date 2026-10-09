"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, ChevronDown, Layers, Loader2, Plus, Store, Trash2, UserRoundCog, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { Field, FormError } from "@/components/workbooks/dialog-shell";
import { TicketFilePicker, fileErrorsFrom, hasBadFiles, withoutFileErrors } from "@/components/toolbox-tickets/file-picker";
import { useRoleOptions } from "@/components/toolbox-tickets/participant-role";
import { ticketHref } from "@/components/toolbox-tickets/tickets-list";
import { TicketUserPicker } from "@/components/toolbox-tickets/user-picker";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useTicketSections } from "@/lib/hooks/use-toolbox-tickets-list";
import { buildContextNote } from "@/lib/report-problem/context-note";
import { FALLBACK_SECTION_KEY, type ReportPage } from "@/lib/report-problem/pages";
import { useToolboxTicketsCatalog } from "@/lib/store/toolbox-tickets-catalog.store";
import { useReportProblem, type ReportDraft } from "@/lib/store/report-problem.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useUIStore } from "@/lib/store/ui.store";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import type { ParticipantRole } from "@/types/toolbox-tickets.types";
import { ScreenshotCard } from "./screenshot-card";
import { useCandidateName } from "./use-candidate-name";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The report dialog. Stacked ABOVE the Screen PiP (z 9999) — overlay      */
/*  10050, content 10051, pickers 10060 — using the exported portal/overlay */
/*  so components/ui stays untouched. Fixed height: header and footer pinned,*/
/*  only the body scrolls.                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const Z_PICKER = "z-[10060]";
const TITLE_MAX = 190;
const DESCRIPTION_MAX = 20_000;
const MAX_PARTICIPANTS = 20;

type AreaStatus = "ok" | "fallback" | "missing" | "unknown";

export function ReportProblemDialog({ page }: { page: ReportPage }) {
  const t = useTranslations("reportProblem.dialog");
  const tRoot = useTranslations();
  const tc = useTranslations("toolboxTickets.common");
  const nameOf = useCandidateName();
  const roleOptions = useRoleOptions();
  const params = useParams();
  const locale = useLocale();
  const urlLocale = (params?.locale as string) || locale;
  const { resolvedTheme } = useTheme();

  const target = useReportProblem((s) => s.target);
  const shot = useReportProblem((s) => s.shot);
  const draft = useReportProblem((s) => s.draft);
  const setDraft = useReportProblem((s) => s.setDraft);
  const close = useReportProblem((s) => s.close);
  const retake = useReportProblem((s) => s.retake);
  const setShotRemoved = useReportProblem((s) => s.setShotRemoved);

  const overviewStores = useAuthStore((s) => s.overviewStores);
  const isImpersonating = useAuthStore((s) => s.isImpersonating);
  const userName = useAuthStore((s) => s.user?.name ?? null);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const layoutVariant = useUIStore((s) => s.layoutVariant);
  const { sections, loading: sectionsLoading, error: sectionsError, reload: reloadSections } = useTicketSections();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const storeOptions = useMemo<SearchableSelectOption<string>[]>(
    () =>
      (overviewStores ?? [])
        // Only real store codes — the ticket API speaks "03795-00001".
        .filter((s): s is typeof s & { storeId: string } => Boolean(s.storeId) && s.storeId !== s.id)
        .map((s) => ({ value: s.storeId, label: s.name || s.storeId, hint: s.storeId })),
    [overviewStores],
  );

  const pageLabel = target ? tRoot(target.pageLabelKey) : "";
  const name = target ? nameOf(target) : { kind: "", label: "" };

  /* ── Draft: created on first open; a Retake refreshes untouched fields. ─ */
  useEffect(() => {
    if (!target) return;
    const suggested = t("titleTemplate", { part: name.label || name.kind, page: pageLabel }).slice(0, TITLE_MAX);
    const current = useReportProblem.getState().draft;
    if (!current) {
      const code = selectedStore?.storeId && storeOptions.some((o) => o.value === selectedStore.storeId)
        ? selectedStore.storeId
        : (storeOptions[0]?.value ?? "");
      const fresh: ReportDraft = {
        title: suggested,
        titleTouched: false,
        description: "",
        sectionKey: target.sectionKey,
        sectionTouched: false,
        storeCode: code,
        files: [],
        participants: [],
      };
      setDraft(fresh);
    } else {
      setDraft({
        ...(current.titleTouched ? {} : { title: suggested }),
        ...(current.sectionTouched ? {} : { sectionKey: target.sectionKey }),
      });
    }
    // Only when the PICK changes (first open or a retake).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.pickedAt]);

  /* ── Area: the resolved key, checked against the live catalogue. ─────── */
  const area = useMemo((): { key: string; status: AreaStatus; wanted: string } => {
    const wanted = draft?.sectionKey ?? target?.sectionKey ?? "";
    if (!sections) return { key: wanted, status: "unknown", wanted };
    const active = new Set(sections.map((s) => s.key));
    if (active.has(wanted)) return { key: wanted, status: "ok", wanted };
    if (active.has(FALLBACK_SECTION_KEY)) return { key: FALLBACK_SECTION_KEY, status: "fallback", wanted };
    return { key: "", status: "missing", wanted };
  }, [draft?.sectionKey, target?.sectionKey, sections]);

  const sectionOptions = useMemo<SearchableSelectOption<string>[]>(
    () => (sections ?? []).map((s) => ({ value: s.key, label: s.name, hint: s.key })),
    [sections],
  );


  const store = storeOptions.find((o) => o.value === draft?.storeCode);
  const noteBody = target
    ? buildContextNote({
        pageLabel,
        pathname: target.pathname,
        search: target.search,
        kind: target.kind,
        label: name.label || name.kind,
        id: target.id,
        sectionKey: area.key || area.wanted,
        sectionSource: draft?.sectionTouched ? "reporter" : target.sectionSource,
        wantedSectionKey: area.status === "fallback" ? area.wanted : null,
        store: store ? { code: store.value, name: store.label } : null,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
        theme: resolvedTheme ?? "light",
        locale,
        dir: document.documentElement.dir || "ltr",
        layoutVariant,
        sidebarCollapsed,
        pickedAt: new Date(target.pickedAt),
        impersonating: isImpersonating,
      })
    : "";

  if (!target || !draft) return null;

  const dirty =
    draft.description.trim().length > 0 ||
    draft.titleTouched ||
    draft.files.length > 0 ||
    draft.participants.length > 0;

  const requestClose = () => {
    if (sending) return;
    if (dirty) setConfirmDiscard(true);
    else close();
  };

  const submit = async () => {
    if (sending) return;
    const e: Record<string, string> = {};
    if (!draft.storeCode) e.store = t("errors.store");
    if (!area.key) e.section_key = t("errors.area");
    if (!draft.title.trim()) e.title = t("errors.title");
    if (!draft.description.trim()) e.description = t("errors.description");
    if (draft.participants.some((p) => !p.user)) e.participants = t("errors.participant");
    if (hasBadFiles(draft.files)) e.files = t("errors.files");
    setErrors(e);
    if (Object.keys(e).length) return;

    setSending(true);
    setFormError(null);
    const screenshot = shot?.status === "ready" && !shot.removed && shot.result ? [shot.result.file] : [];
    try {
      const result = await toolboxTicketsService.createTicket(draft.storeCode, {
        sectionKey: area.key,
        title: draft.title.trim(),
        description: draft.description.trim(),
        participants: draft.participants
          .filter((p): p is { user: { id: number; name: string | null }; role: ParticipantRole } => p.user !== null)
          .map((p) => ({ userId: p.user.id, role: p.role })),
        files: draft.files,
        notes: [{ body: noteBody, files: screenshot }],
      });
      // Close first: Radix hides the toaster from assistive tech while a dialog is open.
      close();
      // A Link, not router.push — page guards (e.g. unsaved schedule drafts) still run.
      toast.success(t("sent", { id: result.ticket.id }), {
        description: (
          <Link href={ticketHref(urlLocale, result.ticket)} className="font-medium underline underline-offset-2">
            {t("viewTicket")}
          </Link>
        ),
        duration: 8000,
      });
      if (result.warnings.includes("no_recipients")) {
        toast.warning(tRoot("toolboxTickets.create.noRecipients"), {
          description: tRoot("toolboxTickets.create.noRecipientsBody"),
          duration: 8000,
        });
      }
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      const participantError = Object.entries(fe).find(([k]) => k.startsWith("participants"))?.[1];
      if (participantError) {
        fe.participants = participantError;
        setShowPeople(true);
      }
      const shotError = Object.entries(fe).find(([k]) => /^notes\.0\.files/.test(k))?.[1];
      if (shotError) fe.screenshot = shotError;
      if (parsed.code === "STORE_NOT_FOUND") fe.store = parsed.message;
      if (parsed.code === "TICKET_SECTION_INACTIVE") {
        fe.section_key = fe.section_key ?? parsed.message;
        void useToolboxTicketsCatalog.getState().reload();
      }
      setErrors(fe);
      const known =
        ["store", "section_key", "title", "description", "participants", "screenshot"].some((k) => fe[k]) ||
        Object.keys(fileErrorsFrom(fe)).length > 0;
      // Anything else — a note body refused, network, server, auth — goes in the banner.
      if (!known) setFormError(fe["notes.0.body"] ?? parsed.message);
    } finally {
      setSending(false);
    }
  };

  const areaHint =
    area.status === "fallback" ? null : draft.sectionTouched
      ? t("area.fromReporter")
      : t(`area.from.${target.sectionSource}`, { part: name.label || name.kind, page: pageLabel });

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[10050]" />
        <DialogPrimitive.Content
          data-slot="report-problem-dialog"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // React's root listener is on `document`; stopping here keeps page
          // shortcuts on `window` (Screens M/C/F, PageGuide arrows) quiet
          // while typing. Radix's own Escape handling runs earlier.
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "bg-background fixed top-[50%] left-[50%] z-[10051] flex h-[88vh] max-h-[760px] w-[95vw] max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200",
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start gap-3 border-b px-5 py-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading font-semibold">{t("title")}</DialogTitle>
              <DialogDescription className="text-xs">{t("description")}</DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={tc("close")}
              disabled={sending}
              onClick={requestClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body — the only part that scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <FormError message={formError} />
              {isImpersonating && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <UserRoundCog className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("impersonating", { name: userName ?? "—" })}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                {/* Left: what was picked, the screenshot, the note */}
                <div className="min-w-0 space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("youPicked")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {name.kind}
                      </Badge>
                      <span className="min-w-0 break-words text-sm font-medium">{name.label || name.kind}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("onPage", { page: pageLabel })}</p>
                  </div>

                  <ScreenshotCard
                    shot={shot}
                    error={errors.screenshot ?? null}
                    disabled={sending}
                    onRetake={retake}
                    onRemove={() => {
                      setShotRemoved(true);
                      setErrors(({ screenshot: _gone, ...rest }) => rest);
                    }}
                    onRestore={() => setShotRemoved(false)}
                  />

                  <div className="rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setShowNote((v) => !v)}
                      aria-expanded={showNote}
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showNote && "-rotate-90 rtl:rotate-90")} />
                      <span className="flex-1">{t("notePreview")}</span>
                    </button>
                    {showNote && (
                      <pre
                        dir="ltr"
                        className="max-h-56 overflow-auto border-t bg-muted/30 px-3 py-2 text-start font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words"
                      >
                        {noteBody}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Right: the fields */}
                <div className="min-w-0 space-y-4">
                  <Field label={t("area.label")} required error={errors.section_key} hint={areaHint}>
                    <SearchableSelect<string>
                      options={sectionOptions}
                      value={area.key}
                      onChange={(sectionKey) => setDraft({ sectionKey, sectionTouched: true })}
                      placeholder={t("area.placeholder")}
                      searchPlaceholder={tc("search")}
                      emptyText={tc("noMatches")}
                      loading={sectionsLoading && !sections}
                      disabled={sending}
                      contentClassName={Z_PICKER}
                      icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                  </Field>
                  {area.status === "fallback" && (
                    <p className="-mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      {t("area.fallback", { key: area.wanted })}
                    </p>
                  )}
                  {area.status === "missing" && (
                    <p className="-mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      {t("area.missing", { key: area.wanted })}
                    </p>
                  )}
                  {sectionsError && (
                    <p className="-mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-destructive">
                      {t("area.loadFailed", { message: sectionsError.message })}
                      <button type="button" className="underline" onClick={() => void reloadSections()}>
                        {t("retry")}
                      </button>
                    </p>
                  )}

                  <Field label={t("store")} required error={errors.store}>
                    <SearchableSelect<string>
                      options={storeOptions}
                      value={draft.storeCode}
                      onChange={(storeCode) => setDraft({ storeCode })}
                      placeholder={t("storePlaceholder")}
                      searchPlaceholder={tc("search")}
                      emptyText={tc("noMatches")}
                      disabled={sending}
                      contentClassName={Z_PICKER}
                      icon={<Store className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                  </Field>

                  <Field
                    label={t("titleLabel")}
                    htmlFor="rp-title"
                    required
                    error={errors.title}
                    hint={`${draft.title.length} / ${TITLE_MAX}`}
                  >
                    <Input
                      id="rp-title"
                      value={draft.title}
                      maxLength={TITLE_MAX}
                      disabled={sending}
                      onChange={(e) => setDraft({ title: e.target.value, titleTouched: true })}
                    />
                  </Field>

                  <Field
                    label={t("whatsWrong")}
                    htmlFor="rp-description"
                    required
                    error={errors.description}
                    hint={`${draft.description.length.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()}`}
                  >
                    <Textarea
                      id="rp-description"
                      value={draft.description}
                      maxLength={DESCRIPTION_MAX}
                      disabled={sending}
                      placeholder={t("whatsWrongPlaceholder")}
                      className="min-h-32 resize-y"
                      onChange={(e) => setDraft({ description: e.target.value })}
                    />
                  </Field>

                  <Field label={t("moreFiles")} error={errors.files} hint={t("moreFilesHint")}>
                    <TicketFilePicker
                      files={draft.files}
                      onChange={(files) => {
                        setDraft({ files });
                        setErrors(withoutFileErrors);
                      }}
                      disabled={sending}
                      serverErrors={fileErrorsFrom(errors)}
                      compact
                    />
                  </Field>

                  {/* Loop people in — optional, folded away */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setShowPeople((v) => !v)}
                      aria-expanded={showPeople}
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showPeople && "-rotate-90 rtl:rotate-90")} />
                      <span className="flex-1">{t("people")}</span>
                      {draft.participants.length > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                          {draft.participants.length}
                        </Badge>
                      )}
                    </button>
                    {showPeople && (
                      <div className="space-y-2 border-t p-3">
                        <p className="text-[11px] text-muted-foreground">{t("peopleHint")}</p>
                        {draft.participants.map((p, i) => (
                          <div key={i} className="grid grid-cols-[minmax(0,1fr)_9rem_auto] gap-2">
                            <TicketUserPicker
                              value={p.user}
                              onChange={(user) =>
                                setDraft({
                                  participants: draft.participants.map((x, j) => (j === i ? { ...x, user } : x)),
                                })
                              }
                              disabled={sending}
                              contentClassName={Z_PICKER}
                            />
                            <SearchableSelect<ParticipantRole>
                              options={roleOptions}
                              value={p.role}
                              onChange={(role) =>
                                setDraft({
                                  participants: draft.participants.map((x, j) => (j === i ? { ...x, role } : x)),
                                })
                              }
                              searchPlaceholder={tc("search")}
                              disabled={sending}
                              contentClassName={Z_PICKER}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={tc("remove")}
                              disabled={sending}
                              onClick={() =>
                                setDraft({ participants: draft.participants.filter((_, j) => j !== i) })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {errors.participants && <p className="text-[11px] text-destructive">{errors.participants}</p>}
                        {draft.participants.length < MAX_PARTICIPANTS && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={sending}
                            onClick={() =>
                              setDraft({ participants: [...draft.participants, { user: null, role: "responder" }] })
                            }
                          >
                            <Plus className="me-1 h-3.5 w-3.5" />
                            {t("addPerson")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
            {confirmDiscard ? (
              <>
                <p className="text-sm font-medium sm:me-auto">{t("discardQuestion")}</p>
                <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
                  {t("keepEditing")}
                </Button>
                <Button variant="destructive" onClick={close}>
                  {t("discard")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={requestClose} disabled={sending}>
                  {tc("cancel")}
                </Button>
                <Button onClick={() => void submit()} disabled={sending || shot?.status === "capturing"}>
                  {sending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {sending ? t("sending") : t("send")}
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
