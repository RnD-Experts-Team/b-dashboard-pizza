"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { TroubleshootingGuide } from "@/types/maintenance-tickets.types";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof MaintenanceTicketsError ? err.message : fallback;
}

/**
 * Write or change an issue's troubleshooting guide: the steps in order, an
 * optional link, files. Every save is a new version -- a ticket keeps the
 * version its manager confirmed, so editing a guide never rewrites history.
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
  guide: TroubleshootingGuide | null;
  onSaved: (guide: TroubleshootingGuide) => void;
  onRemoved?: () => void;
  onCancel?: () => void;
}) {
  const [steps, setSteps] = useState<string[]>(guide?.steps.length ? guide.steps : [""]);
  const [linkUrl, setLinkUrl] = useState(guide?.linkUrl ?? "");
  const [current, setCurrent] = useState<TroubleshootingGuide | null>(guide);
  const [busy, setBusy] = useState<"save" | "remove" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const realSteps = steps.map((s) => s.trim()).filter(Boolean);

  function setStep(i: number, value: string) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? value : s)));
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

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const saved = await maintenanceTicketsService.saveTroubleshootingGuide(issueId, {
        steps: realSteps,
        link_url: linkUrl.trim() || null,
      });
      setCurrent(saved);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "Could not save the guide."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the troubleshooting guide for ${issueTitle}? Tickets already opened keep the steps they confirmed.`)) return;
    setBusy("remove");
    setError(null);
    try {
      await maintenanceTicketsService.deleteTroubleshootingGuide(issueId);
      setCurrent(null);
      onRemoved?.();
    } catch (err) {
      setError(errorMessage(err, "Could not remove the guide."));
    } finally {
      setBusy(null);
    }
  }

  async function addFiles(files: File[]) {
    if (!current || files.length === 0) return;
    setBusy("file");
    setError(null);
    try {
      const added = await maintenanceTicketsService.addTroubleshootingFiles(current.id, files);
      const next = { ...current, attachments: [...current.attachments, ...added] };
      setCurrent(next);
      onSaved(next);
    } catch (err) {
      setError(errorMessage(err, "Could not upload the files."));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeFile(attachmentId: number) {
    if (!current) return;
    setBusy("file");
    setError(null);
    try {
      await maintenanceTicketsService.removeTroubleshootingFile(current.id, attachmentId);
      const next = { ...current, attachments: current.attachments.filter((a) => a.id !== attachmentId) };
      setCurrent(next);
      onSaved(next);
    } catch (err) {
      setError(errorMessage(err, "Could not remove the file."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Troubleshooting for {issueTitle}</p>
        {current && (
          <span className="text-[11px] text-muted-foreground">
            Version {current.version}{current.editor ? ` · last saved by ${current.editor.name}` : ""}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Steps to try, in order</Label>
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 w-5 shrink-0 text-end text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <Textarea
              value={step}
              onChange={(e) => setStep(i, e.target.value)}
              placeholder={i === 0 ? "e.g. Check the oven's breaker in the back panel" : "Next step…"}
              className="min-h-10 flex-1 text-sm"
            />
            <div className="flex shrink-0 flex-col gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down">
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setSteps((prev) => (prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)))}
              aria-label="Remove step"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSteps((prev) => [...prev, ""])}>
          <Plus className="me-1 h-3 w-3" /> Add a step
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Link (optional) -- a video, a manual, a vendor page</Label>
        <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" inputMode="url" className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Files (photos, PDFs)</Label>
        {!current && <p className="text-[11px] text-muted-foreground">Save the steps first, then add files.</p>}
        {current && (
          <>
            {current.attachments.length > 0 && (
              <ul className="space-y-1">
                {current.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                      <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{a.fileName}</span>
                    </a>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeFile(a.id)} disabled={busy !== null} aria-label={`Remove ${a.fileName}`}>
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Input
              ref={fileRef}
              type="file"
              multiple
              className="h-8 text-xs"
              disabled={busy !== null}
              onChange={(e) => void addFiles(Array.from(e.target.files ?? []))}
            />
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy !== null || realSteps.length === 0}>
          {busy === "save" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {current ? "Save as a new version" : "Save the guide"}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy !== null}>
            Close
          </Button>
        )}
        {current && onRemoved && (
          <Button type="button" size="sm" variant="ghost" className="ms-auto text-destructive hover:text-destructive" onClick={() => void remove()} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="me-1.5 h-3.5 w-3.5" />}
            Remove the guide
          </Button>
        )}
      </div>
    </div>
  );
}
