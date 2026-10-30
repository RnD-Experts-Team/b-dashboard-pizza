"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { maintenanceWorkflowService } from "@/lib/api/services/maintenance-workflow.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useMaintenanceSettings } from "@/lib/hooks/use-maintenance-settings";
import { formatMoney, parseDecimal } from "@/lib/maintenance/money";
import { APPROVAL_DECISIONS, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import { approvalLevelOf } from "@/lib/maintenance-workflow";
import type { ApprovalDecision, Inspection, TicketIssueV2 } from "@/types/maintenance-v2";
import { Segmented } from "../../form-bits";
import { PasteFileZone } from "../../paste-file-zone";
import { ActionDialog, Field, MoreDetails, useDialogSubmit } from "../dialog-kit";
import { amountOrNull, formatDayTime } from "../format";
import type { StepDialogProps } from "./types";

/** Inspections still waiting for their result, newest first. */
export function scheduledInspections(issue: TicketIssueV2): Inspection[] {
  return issue.inspections.filter((i) => !i.mistaken && i.status === "scheduled").sort((a, b) => b.id - a.id);
}

/** The latest inspection that gave a quote (the one an approval is about). */
export function quotedInspection(issue: TicketIssueV2): Inspection | null {
  return (
    issue.inspections
      .filter((i) => !i.mistaken && i.status === "done" && i.estimatedCost != null)
      .sort((a, b) => b.id - a.id)[0] ?? null
  );
}

function AmountInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ps-7 tabular-nums"
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}

/* ── Inspection result ───────────────────────────────────────────────────── */

export function InspectionResultDialog({
  open,
  onOpenChange,
  issue,
  run,
  inspectionId,
}: StepDialogProps & { inspectionId?: number | null }) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const open_ = scheduledInspections(issue);
  const [picked, setPicked] = useState(String(inspectionId ?? open_[0]?.id ?? ""));
  const [findings, setFindings] = useState("");
  const [repair, setRepair] = useState("");
  const [parts, setParts] = useState("");
  const [estimate, setEstimate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const dirty = Boolean(findings.trim() || repair.trim() || parts.trim() || estimate || files.length);

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!findings.trim()) missing.findings = t("tickets.dialogs.inspection.findingsRequired");
    if (estimate && amountOrNull(estimate) == null) missing.estimated_cost = t("tickets.dialogs.amountInvalid");
    if (!picked) missing.inspection = t("tickets.dialogs.inspection.pick");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(() =>
      run((key) =>
        maintenanceWorkflowService.recordInspectionResult(key, Number(picked), {
          findings: findings.trim(),
          recommendedRepair: repair.trim() || null,
          partsNeeded: parts.trim() || null,
          estimatedCost: amountOrNull(estimate),
          files,
        }),
      ),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      title={t("workflow.actions.inspection_result")}
      description={t("tickets.dialogs.inspection.help")}
      submitLabel={t("common.save")}
      canSubmit={open_.length > 0}
      onSubmit={() => void onSubmit()}
    >
      {open_.length > 1 ? (
        <Field label={t("tickets.dialogs.inspection.which")} required error={form.fieldError("inspection")}>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger aria-label={t("tickets.dialogs.inspection.which")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {open_.map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {`${i.technician?.name ?? "—"} · ${formatDayTime(i.scheduledDate, i.scheduledTime)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {open_.length === 0 ? <p className="text-sm text-muted-foreground">{t("tickets.dialogs.inspection.noneOpen")}</p> : null}
      <Field id="insp-findings" label={t("tickets.work.findings")} required error={form.fieldError("findings")}>
        <Textarea
          id="insp-findings"
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          className="min-h-24"
          placeholder={t("tickets.dialogs.inspection.findingsPlaceholder")}
          aria-invalid={Boolean(form.fieldError("findings")) || undefined}
        />
      </Field>
      <Field id="insp-estimate" label={t("tickets.dialogs.inspection.estimate")} help={t("tickets.dialogs.inspection.estimateHelp")} error={form.fieldError("estimated_cost")}>
        <AmountInput id="insp-estimate" value={estimate} onChange={setEstimate} invalid={Boolean(form.fieldError("estimated_cost"))} />
      </Field>
      <Field label={t("common.photos")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
      <MoreDetails>
        <Field id="insp-repair" label={t("tickets.work.recommendedRepair")} error={form.fieldError("recommended_repair")}>
          <Textarea id="insp-repair" value={repair} onChange={(e) => setRepair(e.target.value)} className="min-h-16" />
        </Field>
        <Field id="insp-parts" label={t("tickets.work.partsNeeded")} error={form.fieldError("parts_needed")}>
          <Textarea id="insp-parts" value={parts} onChange={(e) => setParts(e.target.value)} className="min-h-16" />
        </Field>
      </MoreDetails>
    </ActionDialog>
  );
}

/* ── Ask for approval ────────────────────────────────────────────────────── */

/** "Needs Maintenance Manager approval" for a typed amount. */
function useLevelLabel(issue: TicketIssueV2, amount: string): string | null {
  const t = useTranslations("maintenanceV2");
  const canReadSettings = useAuthStore((s) => s.canAccessRoute({ service: "Maintenance", method: "GET", path: "/maintenance-settings" }));
  const { settings } = useMaintenanceSettings(canReadSettings);
  const server = issue.workflow?.approvalLevelFor ?? null;
  const n = parseDecimal(amount);
  if (n == null) return null;
  if (settings) {
    const level = approvalLevelOf(n, settings.approvalLevels);
    return level ? t("workflow.needsApprovalFrom", { label: level.label }) : null;
  }
  if (server && parseDecimal(server.amount) === n) return t("workflow.needsApprovalFrom", { label: server.label });
  return null;
}

export function ApprovalRequestDialog({ open, onOpenChange, issue, run }: StepDialogProps) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const quote = quotedInspection(issue);
  const initial = issue.costs?.estimated ?? quote?.estimatedCost ?? "";
  const [amount, setAmount] = useState(initial ?? "");
  const level = useLevelLabel(issue, amount);

  async function onSubmit() {
    const value = amountOrNull(amount);
    if (value == null) return form.setFieldErrors({ amount: t("tickets.dialogs.amountRequired") });
    const ok = await form.submit(
      () => run((key) => maintenanceWorkflowService.requestApproval(key, { amount: value, inspectionId: quote?.id ?? null })),
      t("tickets.dialogs.approval.asked"),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={amount !== initial}
      title={t("workflow.actions.approval_request")}
      description={t("tickets.dialogs.approval.askHelp")}
      submitLabel={t("tickets.dialogs.approval.askSubmit")}
      onSubmit={() => void onSubmit()}
    >
      <Field
        id="approval-amount"
        label={t("common.amount")}
        required
        help={quote ? t("tickets.dialogs.approval.fromQuote", { amount: formatMoney(quote.estimatedCost), technician: quote.technician?.name ?? "—" }) : undefined}
        error={form.fieldError("amount")}
      >
        <AmountInput id="approval-amount" value={amount} onChange={setAmount} invalid={Boolean(form.fieldError("amount"))} />
      </Field>
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium" aria-live="polite">
        {level ?? t("tickets.dialogs.approval.levelUnknown")}
      </p>
    </ActionDialog>
  );
}

/* ── Record the approval ─────────────────────────────────────────────────── */

export function RecordApprovalDialog({ open, onOpenChange, issue, run }: StepDialogProps) {
  const t = useTranslations("maintenanceV2");
  const form = useDialogSubmit();
  const quote = quotedInspection(issue);
  const initialAmount = issue.costs?.estimated ?? quote?.estimatedCost ?? "";
  const [decision, setDecision] = useState<ApprovalDecision | "">("");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [approver, setApprover] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const dirty = Boolean(decision || approver.trim() || note.trim() || files.length || amount !== initialAmount);

  async function onSubmit() {
    const value = amountOrNull(amount);
    const missing: Record<string, string> = {};
    if (!decision) missing.decision = t("tickets.dialogs.approval.decisionRequired");
    if (value == null) missing.amount = t("tickets.dialogs.amountRequired");
    if (!approver.trim()) missing.approver_name = t("tickets.dialogs.approval.approverRequired");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(() =>
      run((key) =>
        maintenanceWorkflowService.recordApproval(key, {
          amount: value as string,
          decision: decision as ApprovalDecision,
          approverName: approver.trim(),
          note: note.trim() || null,
          inspectionId: quote?.id ?? null,
          files,
        }),
      ),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      title={t("workflow.actions.approval")}
      description={t("tickets.dialogs.approval.recordHelp")}
      submitLabel={t("common.save")}
      onSubmit={() => void onSubmit()}
    >
      <Field label={t("tickets.dialogs.approval.decision")} required error={form.fieldError("decision")}>
        <div tabIndex={-1} aria-invalid={Boolean(form.fieldError("decision")) || undefined}>
          <Segmented
            value={decision}
            onChange={setDecision}
            options={vocabOptions(APPROVAL_DECISIONS).map((o) => ({ value: o.value, label: vocabText(t, o) }))}
          />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rec-amount" label={t("common.amount")} required error={form.fieldError("amount")}>
          <AmountInput id="rec-amount" value={amount} onChange={setAmount} invalid={Boolean(form.fieldError("amount"))} />
        </Field>
        <Field id="rec-approver" label={t("tickets.dialogs.approval.approver")} required error={form.fieldError("approver_name")}>
          <Input
            id="rec-approver"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            aria-invalid={Boolean(form.fieldError("approver_name")) || undefined}
          />
        </Field>
      </div>
      <Field label={t("tickets.dialogs.approval.screenshot")} help={t("tickets.dialogs.approval.screenshotHelp")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
      <MoreDetails>
        <Field id="rec-note" label={t("common.note")} error={form.fieldError("note")}>
          <Textarea id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
      </MoreDetails>
    </ActionDialog>
  );
}
