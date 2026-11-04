"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { maintenanceWorkflowService } from "@/lib/api/services/maintenance-workflow.service";
import type { Inspection, IssueSchedule } from "@/types/maintenance-system";
import { DatePicker, TimePicker } from "../../form-bits";
import { ActionDialog, Field, MoreDetails, useDialogSubmit } from "../dialog-kit";
import { amountOrNull, formatDayTime } from "../format";
import { AmountInput } from "./inspection-approval-dialogs";
import { TechnicianPicker } from "../technician-picker";
import type { StepDialogProps } from "./types";

/** What is wrong with a typed window: an end with no start, or an end not after the start. */
export function timeWindowError(from: string, to: string): "start" | "order" | null {
  if (to && !from) return "start";
  if (from && to && to <= from) return "order";
  return null;
}

/** "From" and "To" for a booking: a window of time, both optional. */
function TimeWindowFields({
  from,
  to,
  onFrom,
  onTo,
  fromError,
  toError,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  fromError?: string;
  toError?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  return (
    <>
      <Field label={t("tickets.dialogs.booking.from")} help={t("common.optional")} error={fromError}>
        <TimePicker value={from} onChange={onFrom} placeholder={t("tickets.dialogs.booking.anyTime")} />
      </Field>
      <Field label={t("tickets.dialogs.booking.to")} help={t("common.optional")} error={toError}>
        <TimePicker value={to} onChange={onTo} placeholder={t("tickets.dialogs.booking.anyTime")} />
      </Field>
    </>
  );
}

/** Live bookings (not mistaken, not ended), newest first. */
export function liveSchedules(schedules: readonly IssueSchedule[]): IssueSchedule[] {
  return schedules.filter((s) => !s.mistaken && !s.endedAt).sort((a, b) => b.id - a.id);
}

interface BookingDialogProps extends StepDialogProps {
  /** Called with the booked day, so a new trip link can say "on Tue". */
  onBooked: (date: string) => void;
  /** "Add second opinion": another inspection while one is on file. */
  secondOpinion?: boolean;
}

/** Who did the latest finished inspection: usually the one to do the work. */
function latestInspectorId(inspections: readonly Inspection[]): number | null {
  const done = inspections
    .filter((i) => i.status === "done" && !i.mistaken && i.technician)
    .sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  return done.at(-1)?.technician?.id ?? null;
}

/** Book inspection or Schedule work: technician (ranked), day, time, then the optional details. */
function BookingDialog({
  open,
  onOpenChange,
  issue,
  run,
  storeNumber,
  onBooked,
  kind,
  secondOpinion = false,
}: BookingDialogProps & { kind: "inspection" | "work" }) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  // Scheduling the work starts with whoever inspected it; the dialog mounts
  // fresh on every open, so this is read once per open.
  const [suggestedTechnicianId] = useState(() => (kind === "work" ? latestInspectorId(issue.inspections) : null));
  const [technicianId, setTechnicianId] = useState<number | null>(suggestedTechnicianId);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [fee, setFee] = useState("");
  const [expected, setExpected] = useState("");
  const [instructions, setInstructions] = useState("");
  const dirty = Boolean(technicianId !== suggestedTechnicianId || date || time || timeTo || fee || expected || instructions.trim());
  const urgent = (issue.assignedPriority ?? issue.priority).value === "urgent";
  const isWork = kind === "work";
  const technicianField = "technician_id";
  const dateField = isWork ? "date" : "scheduled_date";
  const fromField = isWork ? "time" : "scheduled_time";
  const toField = isWork ? "time_to" : "scheduled_time_to";

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!technicianId) missing[technicianField] = t("tickets.dialogs.booking.technicianRequired");
    if (!date) missing[dateField] = t("tickets.dialogs.booking.dateRequired");
    const windowError = timeWindowError(time, timeTo);
    if (windowError) missing[windowError === "start" ? fromField : toField] = t(`tickets.dialogs.booking.window.${windowError}`);
    if (fee.trim() && amountOrNull(fee) == null) missing.inspection_fee = t("tickets.dialogs.booking.feeInvalid");
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(
      () =>
        run((key) =>
          isWork
            ? maintenanceWorkflowService.scheduleWork(key, {
                technicianId: technicianId as number,
                date,
                time: time || null,
                timeTo: timeTo || null,
                expectedCompletionDate: expected || null,
                instructions: instructions.trim() || null,
              })
            : maintenanceWorkflowService.bookInspection(key, {
                technicianId: technicianId as number,
                scheduledDate: date,
                scheduledTime: time || null,
                scheduledTimeTo: timeTo || null,
                inspectionFee: amountOrNull(fee),
                instructions: instructions.trim() || null,
              }),
        ),
      isWork ? t("tickets.dialogs.booking.workBooked") : t("tickets.dialogs.booking.inspectionBooked"),
    );
    if (ok) {
      onBooked(date);
      onOpenChange(false);
    }
  }

  const title = isWork ? t("workflow.actions.schedule") : t("workflow.actions.inspection");

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      wide
      title={secondOpinion ? t("tickets.work.addSecondOpinion") : title}
      description={isWork ? t("tickets.dialogs.booking.workHelp") : t("tickets.dialogs.booking.inspectionHelp")}
      submitLabel={title}
      onSubmit={() => void onSubmit()}
    >
      <Field label={t("vocab.terms.technician.label")} required error={form.fieldError(technicianField)}>
        <TechnicianPicker
          id={`book-${kind}-technician`}
          storeNumber={storeNumber}
          catalogIssueId={issue.issue?.id ?? null}
          urgent={urgent}
          value={technicianId}
          onChange={setTechnicianId}
          invalid={Boolean(form.fieldError(technicianField))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("common.date")} required error={form.fieldError(dateField)}>
          <div aria-invalid={Boolean(form.fieldError(dateField)) || undefined} tabIndex={-1}>
            <DatePicker value={date} onChange={setDate} placeholder={t("tickets.dialogs.booking.pickDay")} />
          </div>
        </Field>
        <TimeWindowFields
          from={time}
          to={timeTo}
          onFrom={setTime}
          onTo={setTimeTo}
          fromError={form.fieldError(fromField)}
          toError={form.fieldError(toField)}
        />
      </div>
      {isWork ? null : (
        <Field id="book-inspection-fee" label={t("tickets.dialogs.booking.fee")} help={t("tickets.dialogs.booking.feeHelp")} error={form.fieldError("inspection_fee")}>
          <AmountInput id="book-inspection-fee" value={fee} onChange={setFee} invalid={Boolean(form.fieldError("inspection_fee"))} />
        </Field>
      )}
      <MoreDetails>
        {isWork ? (
          <Field
            label={t("tickets.work.expectedCompletion")}
            help={t("tickets.dialogs.booking.expectedHelp")}
            error={form.fieldError("expected_completion_date")}
          >
            <DatePicker value={expected} onChange={setExpected} placeholder={t("tickets.dialogs.booking.pickDay")} />
          </Field>
        ) : null}
        <Field id={`book-${kind}-instructions`} label={t("tickets.dialogs.booking.instructions")} help={t("tickets.dialogs.booking.instructionsHelp")} error={form.fieldError("instructions")}>
          <Textarea
            id={`book-${kind}-instructions`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-16"
          />
        </Field>
      </MoreDetails>
    </ActionDialog>
  );
}

export function BookInspectionDialog(props: BookingDialogProps) {
  return <BookingDialog {...props} kind="inspection" />;
}

export function ScheduleWorkDialog(props: BookingDialogProps) {
  return <BookingDialog {...props} kind="work" />;
}

/* ── Move a booking ──────────────────────────────────────────────────────── */

export function MoveBookingDialog({
  open,
  onOpenChange,
  issue,
  run,
  scheduleId,
}: StepDialogProps & { scheduleId?: number | null }) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  const bookings = liveSchedules(issue.schedules);
  const [picked, setPicked] = useState<string>(String(scheduleId ?? bookings[0]?.id ?? ""));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [reason, setReason] = useState("");
  const current = bookings.find((b) => String(b.id) === picked) ?? null;

  async function onSubmit() {
    const missing: Record<string, string> = {};
    if (!date) missing.date = t("tickets.dialogs.booking.dateRequired");
    if (!reason.trim()) missing.reason = t("tickets.dialogs.reasonRequired");
    if (!current) missing.schedule = t("tickets.dialogs.move.pickBooking");
    const windowError = timeWindowError(time, timeTo);
    if (windowError) missing[windowError === "start" ? "time" : "time_to"] = t(`tickets.dialogs.booking.window.${windowError}`);
    if (Object.keys(missing).length) return form.setFieldErrors(missing);
    const ok = await form.submit(
      () => run((key) => maintenanceWorkflowService.moveSchedule(key, (current as IssueSchedule).id, { date, time: time || null, timeTo: timeTo || null, reason: reason.trim() })),
      t("tickets.dialogs.move.moved"),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(date || time || timeTo || reason.trim())}
      title={t("workflow.actions.move")}
      description={t("tickets.dialogs.move.help")}
      submitLabel={t("tickets.dialogs.move.submit")}
      canSubmit={bookings.length > 0}
      onSubmit={() => void onSubmit()}
    >
      {bookings.length > 1 ? (
        <Field label={t("tickets.dialogs.move.booking")} required error={form.fieldError("schedule")}>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger aria-label={t("tickets.dialogs.move.booking")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bookings.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {`${t(`tickets.work.kind.${b.kind}`)} · ${b.technician?.name ?? "—"} · ${formatDayTime(b.date, b.time, b.timeTo)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {current ? (
        <p className="text-sm text-muted-foreground">
          {t("tickets.dialogs.move.now", { when: formatDayTime(current.date, current.time, current.timeTo), technician: current.technician?.name ?? "—" })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("tickets.work.noBookings")}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("tickets.dialogs.move.newDay")} required error={form.fieldError("date")}>
          <div aria-invalid={Boolean(form.fieldError("date")) || undefined} tabIndex={-1}>
            <DatePicker value={date} onChange={setDate} placeholder={t("tickets.dialogs.booking.pickDay")} />
          </div>
        </Field>
        <TimeWindowFields from={time} to={timeTo} onFrom={setTime} onTo={setTimeTo} fromError={form.fieldError("time")} toError={form.fieldError("time_to")} />
      </div>
      <Field id="move-reason" label={t("common.reason")} required help={t("common.reasonHelp")} error={form.fieldError("reason")}>
        <Textarea
          id="move-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-16"
          aria-invalid={Boolean(form.fieldError("reason")) || undefined}
        />
      </Field>
    </ActionDialog>
  );
}
