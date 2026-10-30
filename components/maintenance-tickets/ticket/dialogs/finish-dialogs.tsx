"use client";

import { useState } from "react";
import { CircleCheck, CircleDashed, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { maintenanceTicketsService } from "@/lib/api/services/maintenance-tickets.service";
import { maintenanceWorkflowService } from "@/lib/api/services/maintenance-workflow.service";
import { CLOSE_CHECKLIST, ISSUE_STATUSES, RESOLUTIONS, vocabEntry, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import { CHECKLIST_EXEMPT_RESOLUTIONS, CLOSE_RESOLUTIONS, openChecklistItems } from "@/lib/maintenance-workflow";
import type { CloseChecklistItem, CloseResolution, IssueStatus } from "@/types/maintenance-v2";
import { DatePicker } from "../../form-bits";
import { PasteFileZone } from "../../paste-file-zone";
import { ActionDialog, Field, MoreDetails, useDialogSubmit } from "../dialog-kit";
import type { StepDialogProps } from "./types";

/* ── Mark work done ──────────────────────────────────────────────────────── */

export function WorkDoneDialog({ open, onOpenChange, run }: StepDialogProps) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [work, setWork] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [withWarranty, setWithWarranty] = useState(false);
  const [warrantyBody, setWarrantyBody] = useState("");
  const [warrantyUntil, setWarrantyUntil] = useState("");
  const dirty = Boolean(work.trim() || files.length || warrantyBody.trim() || warrantyUntil);

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!work.trim()) missing.work_performed = t("tickets.dialogs.workDone.workRequired");
    if (withWarranty && !warrantyBody.trim()) missing["warranty.body"] = t("tickets.dialogs.workDone.warrantyBodyRequired");
    if (withWarranty && !warrantyUntil) missing["warranty.expiry_date"] = t("tickets.dialogs.workDone.warrantyDateRequired");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(
      () =>
        run((key) =>
          maintenanceWorkflowService.markWorkDone(key, {
            workPerformed: work.trim(),
            files,
            warranty: withWarranty ? { body: warrantyBody.trim(), expiryDate: warrantyUntil } : null,
          }),
        ),
      t("tickets.dialogs.workDone.saved"),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      title={t("workflow.actions.work_done")}
      description={t("tickets.dialogs.workDone.help")}
      submitLabel={t("workflow.actions.work_done")}
      onSubmit={() => void onSubmit()}
    >
      <Field id="wd-work" label={t("tickets.dialogs.workDone.work")} required error={form.fieldError("work_performed")}>
        <Textarea
          id="wd-work"
          value={work}
          onChange={(e) => setWork(e.target.value)}
          className="min-h-24"
          placeholder={t("tickets.dialogs.workDone.workPlaceholder")}
          aria-invalid={Boolean(form.fieldError("work_performed")) || undefined}
        />
      </Field>
      <Field label={t("tickets.dialogs.workDone.photos")} help={t("tickets.dialogs.workDone.photosHelp")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
      {withWarranty ? (
        <div className="space-y-4 rounded-md border p-3">
          <Field id="wd-warranty" label={t("tickets.dialogs.workDone.warranty")} required error={form.fieldError("warranty.body")}>
            <Textarea
              id="wd-warranty"
              value={warrantyBody}
              onChange={(e) => setWarrantyBody(e.target.value)}
              className="min-h-16"
              placeholder={t("tickets.dialogs.workDone.warrantyPlaceholder")}
              aria-invalid={Boolean(form.fieldError("warranty.body")) || undefined}
            />
          </Field>
          <Field label={t("tickets.dialogs.workDone.warrantyUntil")} required error={form.fieldError("warranty.expiry_date")}>
            <div tabIndex={-1} aria-invalid={Boolean(form.fieldError("warranty.expiry_date")) || undefined}>
              <DatePicker value={warrantyUntil} onChange={setWarrantyUntil} />
            </div>
          </Field>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWithWarranty(false)}>
            {t("tickets.dialogs.workDone.removeWarranty")}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setWithWarranty(true)}>
          <ShieldCheck className="me-1.5 h-4 w-4" aria-hidden="true" />
          {t("tickets.dialogs.workDone.addWarranty")}
        </Button>
      )}
    </ActionDialog>
  );
}

/* ── Close ───────────────────────────────────────────────────────────────── */

export function ChecklistView({ items, resolution }: { items: readonly CloseChecklistItem[]; resolution: CloseResolution | null }) {
  const t = useTranslations("maintenanceV2");
  const exempt = resolution ? CHECKLIST_EXEMPT_RESOLUTIONS.has(resolution) : false;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const done = exempt || item.done;
        const entry = vocabEntry(CLOSE_CHECKLIST, item.key, item.label);
        return (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {done ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <CircleDashed className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            )}
            <span className={cn(!done && "text-foreground", done && "text-muted-foreground")}>{vocabText(t, entry)}</span>
            <span className="sr-only">{done ? t("tickets.overview.checkDone") : t("tickets.overview.checkOpen")}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CloseDialog({ open, onOpenChange, issue, run }: StepDialogProps) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [resolution, setResolution] = useState<CloseResolution | "">("");
  const [finalNote, setFinalNote] = useState("");
  const [learned, setLearned] = useState("");
  const [override, setOverride] = useState("");
  const checklist = issue.workflow?.checklist ?? [];
  const open_ = openChecklistItems(checklist, resolution || null);
  const needsReason = Boolean(resolution) && open_.length > 0;
  const dirty = Boolean(resolution || finalNote.trim() || learned.trim() || override.trim());

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!resolution) missing.resolution = t("tickets.dialogs.close.resolutionRequired");
    if (needsReason && !override.trim()) missing.override_reason = t("tickets.dialogs.close.reasonRequired");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(
      () =>
        run((key) =>
          maintenanceWorkflowService.close(key, {
            resolution: resolution as CloseResolution,
            finalNote: finalNote.trim() || null,
            whatWeLearned: learned.trim() || null,
            overrideReason: needsReason ? override.trim() : null,
          }),
        ),
      t("tickets.dialogs.close.closed"),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      title={t("workflow.actions.close")}
      description={t("tickets.dialogs.close.help")}
      submitLabel={t("workflow.actions.close")}
      onSubmit={() => void onSubmit()}
    >
      <Field label={t("tickets.dialogs.close.resolution")} required error={form.fieldError("resolution")}>
        <Select value={resolution} onValueChange={(v) => setResolution(v as CloseResolution)}>
          <SelectTrigger aria-label={t("tickets.dialogs.close.resolution")} aria-invalid={Boolean(form.fieldError("resolution")) || undefined}>
            <SelectValue placeholder={t("tickets.dialogs.close.pickResolution")} />
          </SelectTrigger>
          <SelectContent>
            {CLOSE_RESOLUTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {vocabText(t, RESOLUTIONS[r])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {checklist.length ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{t("tickets.overview.closeChecklist")}</p>
          <ChecklistView items={checklist} resolution={resolution || null} />
        </div>
      ) : null}
      {needsReason ? (
        <Field id="close-override" label={t("workflow.overrideReason")} required help={t("tickets.dialogs.close.reasonHelp")} error={form.fieldError("override_reason")}>
          <Textarea
            id="close-override"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            className="min-h-16"
            aria-invalid={Boolean(form.fieldError("override_reason")) || undefined}
          />
        </Field>
      ) : null}
      <MoreDetails>
        <Field id="close-final" label={t("tickets.dialogs.close.finalNote")} error={form.fieldError("final_note")}>
          <Textarea id="close-final" value={finalNote} onChange={(e) => setFinalNote(e.target.value)} className="min-h-16" />
        </Field>
        <Field id="close-learned" label={t("tickets.dialogs.close.learned")} help={t("tickets.dialogs.close.learnedHelp")} error={form.fieldError("what_we_learned")}>
          <Textarea id="close-learned" value={learned} onChange={(e) => setLearned(e.target.value)} className="min-h-16" />
        </Field>
      </MoreDetails>
    </ActionDialog>
  );
}

/* ── Jump to a status ────────────────────────────────────────────────────── */

export function JumpDialog({ open, onOpenChange, issue, run }: StepDialogProps) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [status, setStatus] = useState<IssueStatus | "">("");
  const [reason, setReason] = useState("");
  const choices = vocabOptions(ISSUE_STATUSES).filter((s) => s.value !== issue.status.value);

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!status) missing.status = t("tickets.dialogs.jump.statusRequired");
    if (!reason.trim()) missing.reason = t("tickets.dialogs.reasonRequired");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(() => run((key) => maintenanceWorkflowService.jump(key, { status: status as IssueStatus, reason: reason.trim() })));
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(status || reason.trim())}
      title={t("workflow.actions.jump")}
      description={t("tickets.dialogs.jump.help", { status: issue.status.label })}
      submitLabel={t("tickets.dialogs.jump.submit")}
      onSubmit={() => void onSubmit()}
    >
      <Field label={t("tickets.dialogs.jump.status")} required error={form.fieldError("status")}>
        <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
          <SelectTrigger aria-label={t("tickets.dialogs.jump.status")} aria-invalid={Boolean(form.fieldError("status")) || undefined}>
            <SelectValue placeholder={t("tickets.dialogs.jump.pickStatus")} />
          </SelectTrigger>
          <SelectContent>
            {choices.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {vocabText(t, s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="jump-reason" label={t("common.reason")} required help={t("common.reasonHelp")} error={form.fieldError("reason")}>
        <Textarea
          id="jump-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-16"
          aria-invalid={Boolean(form.fieldError("reason")) || undefined}
        />
      </Field>
    </ActionDialog>
  );
}

/* ── Cancel (this issue, or the whole ticket) ────────────────────────────── */

export function CancelDialog({
  open,
  onOpenChange,
  run,
  storeNumber,
  scope,
  ticketId,
  onTicketCancelled,
}: StepDialogProps & { scope: "issue" | "ticket"; ticketId: number; onTicketCancelled: () => void }) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const [reason, setReason] = useState("");
  const whole = scope === "ticket";

  async function onSubmit() {
    if (!reason.trim()) return form.setFieldErrors({ reason: t("tickets.dialogs.reasonRequired") });
    const ok = await form.submit(
      () =>
        whole
          ? maintenanceTicketsService.cancelTicket(storeNumber ?? "", ticketId, { reason: reason.trim() })
          : run((key) => maintenanceWorkflowService.cancel(key, { reason: reason.trim() })),
      t("tickets.dialogs.cancel.done"),
    );
    if (!ok) return;
    if (whole) onTicketCancelled();
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(reason.trim())}
      destructive
      title={whole ? t("tickets.page.cancelTicket") : t("tickets.page.cancelIssue")}
      description={t("tickets.dialogs.cancel.help")}
      submitLabel={whole ? t("tickets.page.cancelTicket") : t("tickets.page.cancelIssue")}
      onSubmit={() => void onSubmit()}
    >
      <Field id="cancel-reason" label={t("common.reason")} required help={t("common.reasonHelp")} error={form.fieldError("reason")}>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-20"
          aria-invalid={Boolean(form.fieldError("reason")) || undefined}
        />
      </Field>
    </ActionDialog>
  );
}
