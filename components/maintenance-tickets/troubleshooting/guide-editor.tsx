"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { TicketAttachment, TroubleshootingGuide } from "@/types/maintenance-tickets.types";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof MaintenanceTicketsError ? err.message : fallback;
}

/** A step in the editor. `id` once saved -- only a saved step can take files. */
interface DraftStep {
  key: string;
  id?: number;
  body: string;
  attachments: TicketAttachment[];
}

function draftOf(guide: TroubleshootingGuide | null): DraftStep[] {
  if (!guide || guide.steps.length === 0) return [newStep()];
  return guide.steps.map((s) => ({ key: `s${s.id}`, id: s.id, body: s.body, attachments: s.attachments }));
}

function newStep(): DraftStep {
  return { key: Math.random().toString(36).slice(2), body: "", attachments: [] };
}

/** Files on a guide or a step: the list with remove buttons, and a picker. */
function FilesField({
  attachments,
  disabled,
  onAdd,
  onRemove,
}: {
  attachments: TicketAttachment[];
  disabled: boolean;
  onAdd: (files: File[]) => Promise<void>;
  onRemove: (attachmentId: number) => Promise<void>;
}) {
  const t = useTranslations("maintenanceSystem.troubleshooting");
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-1">
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{a.fileName}</span>
              </a>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => void onRemove(a.id)} disabled={disabled} aria-label={t("removeFile", { name: a.fileName })}>
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        ref={ref}
        type="file"
        multiple
        className="h-8 text-xs"
        disabled={disabled}
        onChange={async (e) => {
          await onAdd(Array.from(e.target.files ?? []));
          if (ref.current) ref.current.value = "";
        }}
      />
    </div>
  );
}

/**
 * Write or change one troubleshooting guide: the problem it is for, the steps
 * in order (each with its own photos or videos), an optional link and files
 * for the whole guide. Every save is a new version -- a ticket keeps the
 * version its manager tried, so editing a guide never rewrites history.
 */
export function GuideEditor({
  issueId,
  issueTitle,
  guide,
  onSaved,
  onRemoved,
  onCancel,
}: {
  issueId: number;
  issueTitle: string;
  /** Null to write a new guide for the issue. */
  guide: TroubleshootingGuide | null;
  onSaved: (guide: TroubleshootingGuide) => void;
  onRemoved?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("maintenanceSystem.troubleshooting");
  const tc = useTranslations("maintenanceSystem.common");
  const [title, setTitle] = useState(guide?.title ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => draftOf(guide));
  const [linkUrl, setLinkUrl] = useState(guide?.linkUrl ?? "");
  const [current, setCurrent] = useState<TroubleshootingGuide | null>(guide);
  const [busy, setBusy] = useState<"save" | "remove" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const realSteps = steps.filter((s) => s.body.trim() !== "");
  const unsaved = steps.some((s) => s.id === undefined && s.body.trim() !== "");

  function setStep(key: string, body: string) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, body } : s)));
  }

  function move(i: number, by: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + by;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function publish(next: TroubleshootingGuide) {
    setCurrent(next);
    onSaved(next);
  }

  async function save() {
    setBusy("save");
    setError(null);
    const payload = {
      title: title.trim(),
      steps: realSteps.map((s) => ({ ...(s.id ? { id: s.id } : {}), body: s.body.trim() })),
      link_url: linkUrl.trim() || null,
    };
    try {
      const saved = current
        ? await maintenanceTicketsService.updateTroubleshootingGuide(current.id, payload)
        : await maintenanceTicketsService.createTroubleshootingGuide(issueId, payload);
      setSteps(draftOf(saved));
      publish(saved);
    } catch (err) {
      setError(errorMessage(err, t("saveFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!current) return;
    if (!window.confirm(t("removeConfirm", { title: current.title, issue: issueTitle }))) return;
    setBusy("remove");
    setError(null);
    try {
      await maintenanceTicketsService.deleteTroubleshootingGuide(current.id);
      onRemoved?.();
    } catch (err) {
      setError(errorMessage(err, t("removeFailed")));
    } finally {
      setBusy(null);
    }
  }

  /** Runs a file change and applies its result to both the draft and the saved guide. */
  async function fileChange(run: () => Promise<(g: TroubleshootingGuide) => TroubleshootingGuide>, fallback: string) {
    if (!current) return;
    setBusy("file");
    setError(null);
    try {
      const apply = await run();
      const next = apply(current);
      setSteps((prev) => prev.map((s) => {
        const saved = next.steps.find((x) => x.id === s.id);
        return saved ? { ...s, attachments: saved.attachments } : s;
      }));
      publish(next);
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(null);
    }
  }

  const addStepFiles = (stepId: number, files: File[]) =>
    files.length === 0 ? Promise.resolve() : fileChange(async () => {
      const added = await maintenanceTicketsService.addTroubleshootingStepFiles(stepId, files);
      return (g) => ({ ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, attachments: [...s.attachments, ...added] } : s)) });
    }, t("uploadFailed"));

  const removeStepFile = (stepId: number, attachmentId: number) =>
    fileChange(async () => {
      await maintenanceTicketsService.removeTroubleshootingStepFile(stepId, attachmentId);
      return (g) => ({ ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, attachments: s.attachments.filter((a) => a.id !== attachmentId) } : s)) });
    }, t("removeFileFailed"));

  const addGuideFiles = (files: File[]) =>
    files.length === 0 || !current ? Promise.resolve() : fileChange(async () => {
      const added = await maintenanceTicketsService.addTroubleshootingFiles(current.id, files);
      return (g) => ({ ...g, attachments: [...g.attachments, ...added] });
    }, t("uploadFailed"));

  const removeGuideFile = (attachmentId: number) =>
    !current ? Promise.resolve() : fileChange(async () => {
      await maintenanceTicketsService.removeTroubleshootingFile(current.id, attachmentId);
      return (g) => ({ ...g, attachments: g.attachments.filter((a) => a.id !== attachmentId) });
    }, t("removeFileFailed"));

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{current ? t("editTitle", { issue: issueTitle }) : t("newTitle", { issue: issueTitle })}</p>
        {current && (
          <span className="text-xs text-muted-foreground">
            {current.editor
              ? t("versionBy", { version: current.version, name: current.editor.name })
              : t("version", { version: current.version })}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-sm">{t("problemLabel")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("problemPlaceholder")} className="text-sm" maxLength={255} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{t("stepsLabel")}</Label>
        {steps.map((step, i) => (
          <div key={step.key} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
            <div className="flex items-start gap-1.5">
              <span className="mt-2 w-5 shrink-0 text-end text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
              <Textarea
                value={step.body}
                onChange={(e) => setStep(step.key, e.target.value)}
                placeholder={i === 0 ? t("firstStepPlaceholder") : t("nextStepPlaceholder")}
                className="min-h-10 flex-1 bg-background text-sm"
              />
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("moveUp")}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={t("moveDown")}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setSteps((prev) => (prev.length === 1 ? [newStep()] : prev.filter((s) => s.key !== step.key)))}
                aria-label={t("removeStep")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="ps-6">
              {step.id !== undefined ? (
                <FilesField
                  attachments={step.attachments}
                  disabled={busy !== null}
                  onAdd={(files) => addStepFiles(step.id!, files)}
                  onRemove={(attachmentId) => removeStepFile(step.id!, attachmentId)}
                />
              ) : (
                <p className="text-xs text-muted-foreground">{t("stepFilesLater")}</p>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSteps((prev) => [...prev, newStep()])}>
          <Plus className="me-1 h-3 w-3" /> {t("addStep")}
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">{t("linkLabel")}</Label>
        <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" inputMode="url" className="text-sm" />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">{t("guideFilesLabel")}</Label>
        {current ? (
          <FilesField attachments={current.attachments} disabled={busy !== null} onAdd={addGuideFiles} onRemove={removeGuideFile} />
        ) : (
          <p className="text-xs text-muted-foreground">{t("guideFilesLater")}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy !== null || realSteps.length === 0 || title.trim() === ""}>
          {busy === "save" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {current ? t("saveNewVersion") : t("saveGuide")}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy !== null}>
            {unsaved ? t("discardChanges") : tc("close")}
          </Button>
        )}
        {current && onRemoved && (
          <Button type="button" size="sm" variant="ghost" className="ms-auto text-destructive hover:text-destructive" onClick={() => void remove()} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="me-1.5 h-3.5 w-3.5" />}
            {t("removeGuide")}
          </Button>
        )}
      </div>
    </div>
  );
}
