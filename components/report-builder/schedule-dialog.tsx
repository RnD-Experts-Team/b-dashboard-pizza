"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CalendarClock, Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useReportRecipients } from "@/lib/hooks/use-report-recipients";
import { readReportError } from "@/lib/report-builder/errors";
import {
  DAYS_OF_MONTH,
  SCHEDULE_DELIVERIES,
  SCHEDULE_FORMATS,
  SCHEDULE_FREQUENCIES,
  SCHEDULE_TIMEZONES,
  WEEKDAYS,
  defaultScheduleValues,
  scheduleFormSchema,
  toScheduleInput,
  type ScheduleFormValues,
} from "@/lib/report-builder/schedule";
import type { ReportSchedule, ReportTemplate, ScheduleInput } from "@/types/report-builder.types";
import { RecipientsPicker } from "./recipients-picker";
import { useScheduleErrorText } from "./use-schedule-error-text";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The schedule being edited; null creates a new one. */
  schedule: ReportSchedule | null;
  /** Template id to preselect when creating (the "Schedule" action on a template row). */
  templateId: string | null;
  /** The reports a schedule can be made for. */
  templates: ReportTemplate[];
  /** Saves (create when `id` is null, else update). Rejects with the failure; the dialog shows it. */
  onSubmit: (id: ReportSchedule["id"] | null, input: ScheduleInput) => Promise<void>;
}

/** The form's fields a server-side 422 can point at (`recipients.users.0` → recipients). */
const FIELD_OF_ERROR: Record<string, keyof ScheduleFormValues> = {
  template_id: "template_id",
  frequency: "frequency",
  run_time: "run_time",
  weekday: "weekday",
  day_of_month: "day_of_month",
  timezone: "timezone",
  recipients: "recipients",
  format: "format",
  delivery: "delivery",
};

const HTTP_UNPROCESSABLE = 422;

function fieldOf(serverKey: string): keyof ScheduleFormValues | null {
  return FIELD_OF_ERROR[serverKey.split(".")[0]] ?? null;
}

/** Create or edit one schedule. The body mounts afresh on every open, so it starts from the right values. */
export function ScheduleDialog(props: ScheduleDialogProps) {
  const t = useTranslations("reportBuilder.schedules.dialog");
  const { open, onOpenChange, schedule } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            {schedule ? t("titleEdit") : t("titleNew")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open && <ScheduleForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({ onOpenChange, schedule, templateId, templates, onSubmit }: ScheduleDialogProps) {
  const t = useTranslations("reportBuilder.schedules");
  const tc = useTranslations("reportBuilder.common");
  const errorText = useScheduleErrorText();
  const { user } = useAuthStore();
  const me = useMemo(() => (user ? { id: String(user.id), name: user.name } : null), [user]);
  const recipients = useReportRecipients(true);
  const [failure, setFailure] = useState<string | null>(null);

  const schema = useMemo(() => scheduleFormSchema((key, values) => t(`validation.${key}`, values)), [t]);
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultScheduleValues(schedule, templateId, me?.id ?? null),
  });
  const { control, handleSubmit, setError, formState } = form;
  const frequency = useWatch({ control, name: "frequency" });

  const templateOptions = useMemo(
    () => templates.map((tpl) => ({ value: String(tpl.id), label: tpl.name })),
    [templates],
  );

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSubmit(schedule ? schedule.id : null, toScheduleInput(values));
      onOpenChange(false);
    } catch (err) {
      const e = readReportError(err);
      const pointed = Object.entries(e.fieldErrors)
        .map(([key, messages]) => ({ field: fieldOf(key), message: messages[0] }))
        .filter((p): p is { field: keyof ScheduleFormValues; message: string } => p.field !== null && Boolean(p.message));
      pointed.forEach((p) => setError(p.field, { message: p.message }));
      setFailure(pointed.length > 0 && e.status === HTTP_UNPROCESSABLE ? null : errorText(err));
    }
  });

  const fieldError = (name: keyof ScheduleFormValues) => {
    const message = formState.errors[name]?.message;
    return message ? <p className="text-[11px] text-destructive">{String(message)}</p> : null;
  };

  // The saved schedule's zone stays choosable even when it is not on the short list.
  const savedZone = form.getValues("timezone");
  const zones = SCHEDULE_TIMEZONES.map((z) => ({ id: z.id as string, label: t(`timezones.${z.key}`) }));
  if (!zones.some((z) => z.id === savedZone)) zones.push({ id: savedZone, label: savedZone });

  const usersBlocked = recipients.status === "forbidden";

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {failure && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label>{t("dialog.template")}</Label>
        <Controller
          control={control}
          name="template_id"
          render={({ field }) => (
            <SearchableSelect<string>
              options={templateOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={t("dialog.templatePlaceholder")}
              searchPlaceholder={tc("search")}
              emptyText={tc("noResults")}
              disabled={schedule !== null}
              contentClassName="z-[60]"
            />
          )}
        />
        {fieldError("template_id")}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("dialog.frequency")}</Label>
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {SCHEDULE_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`frequency.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldError("frequency")}
        </div>

        {frequency === "weekly" && (
          <div className="space-y-1.5">
            <Label>{t("dialog.weekday")}</Label>
            <Controller
              control={control}
              name="weekday"
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t(`weekdays.${d}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {fieldError("weekday")}
          </div>
        )}

        {frequency === "monthly" && (
          <div className="space-y-1.5">
            <Label>{t("dialog.dayOfMonth")}</Label>
            <Controller
              control={control}
              name="day_of_month"
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60] max-h-64">
                    {DAYS_OF_MONTH.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[11px] text-muted-foreground">{t("dialog.dayOfMonthHint")}</p>
            {fieldError("day_of_month")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("dialog.time")}</Label>
          <Controller
            control={control}
            name="run_time"
            render={({ field }) => (
              <TimePicker value={field.value} onChange={field.onChange} placeholder={t("dialog.timePlaceholder")} className="w-full" />
            )}
          />
          {fieldError("run_time")}
        </div>
        <div className="space-y-1.5">
          <Label>{t("dialog.timezone")}</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldError("timezone")}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("dialog.recipients")}</Label>
        <Controller
          control={control}
          name="recipients"
          render={({ field }) => (
            <RecipientsPicker
              users={recipients.users}
              selected={field.value}
              onChange={field.onChange}
              loading={recipients.status === "loading"}
              me={me}
              disabled={usersBlocked}
              invalid={Boolean(formState.errors.recipients)}
            />
          )}
        />
        {fieldError("recipients")}
        {usersBlocked && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {t("dialog.usersForbidden")}
          </p>
        )}
        {recipients.status === "error" && (
          <p className="flex items-center gap-2 text-[11px] text-destructive">
            {t("dialog.usersError")}
            <button type="button" onClick={recipients.reload} className="underline underline-offset-2">
              {t("actions.retry")}
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("dialog.format")}</Label>
          <Controller
            control={control}
            name="format"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {SCHEDULE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`format.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldError("format")}
        </div>
        <div className="space-y-1.5">
          <Label>{t("dialog.delivery")}</Label>
          <Controller
            control={control}
            name="delivery"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {SCHEDULE_DELIVERIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`delivery.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldError("delivery")}
        </div>
      </div>

      {schedule && (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <Label htmlFor="schedule-active">{t("dialog.active")}</Label>
            <p className="text-[11px] text-muted-foreground">{t("dialog.activeHint")}</p>
          </div>
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => <Switch id="schedule-active" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("dialog.notice")}
      </p>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {schedule ? t("actions.saveChanges") : t("actions.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
