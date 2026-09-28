"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBreaksStore } from "@/lib/store/breaks.store";
import { useBreakMutations } from "@/lib/hooks/use-break-mutations";
import { BreakError, fieldForCode, parseBreakError } from "@/lib/break-logger/errors";
import {
  CUSTOM_LABEL_MAX,
  buildCreatePayload,
  buildUpdatePayload,
  cleanLabel,
  type BreakFormState,
} from "@/lib/break-logger/payload";
import {
  isoToLocalInput,
  localInputToIso,
  retentionMinDate,
  toIsoWithOffset,
} from "@/lib/break-logger/work-date";
import type { BreakEntry } from "@/types/breaks.types";
import { useBreakErrorText, useFormatTime, useFormatWorkDate } from "./break-ui";
import { BreakDateTimeField } from "./break-datetime-field";
import { BreakTypeCombobox, type BreakTypeOption } from "./break-type-combobox";

export type BreakEntryDialogMode = { kind: "create" } | { kind: "edit"; entry: BreakEntry };

type FieldKey = "break_type_id" | "other_label" | "started_at" | "ended_at";

function initialForm(mode: BreakEntryDialogMode): BreakFormState {
  if (mode.kind === "edit") {
    const e = mode.entry;
    return {
      breakTypeId: e.break_type.id,
      requiresCustomLabel: e.break_type.requires_custom_label,
      otherLabel: e.other_label ?? "",
      startedAt: isoToLocalInput(e.started_at),
      endedAt: isoToLocalInput(e.ended_at),
      stillRunning: e.running,
    };
  }
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end.getTime() - 15 * 60_000);
  return {
    breakTypeId: null,
    requiresCustomLabel: false,
    otherLabel: "",
    startedAt: isoToLocalInput(toIsoWithOffset(start)),
    endedAt: isoToLocalInput(toIsoWithOffset(end)),
    stillRunning: false,
  };
}

/**
 * Manual entry ("forgot to time it") and edit, one form.
 *
 * Every rule the API enforces is mirrored client-side for fast feedback, but
 * the server stays authoritative (its checks run under a lock): any 422/409
 * is mapped back onto the field it's about, and BREAK_OVERLAP lists the
 * breaks that clash.
 */
export function BreakEntryDialog({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BreakEntryDialogMode;
  onSaved?: (entry: BreakEntry) => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const formatWorkDate = useFormatWorkDate();
  const types = useBreaksStore((s) => s.types);
  const today = useBreaksStore((s) => s.today);
  const { create, update } = useBreakMutations();

  const [form, setForm] = useState<BreakFormState>(() => initialForm(mode));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<BreakError | null>(null);
  const [oldestWorkDate, setOldestWorkDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = mode.kind === "edit" ? mode.entry : null;

  // Re-seed whenever the dialog opens for a (possibly different) entry.
  useEffect(() => {
    if (!open) return;
    setForm(initialForm(mode));
    setFieldErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  /** Active types, plus the entry's own type if it has since been retired. */
  const options = useMemo<BreakTypeOption[]>(() => {
    const list: BreakTypeOption[] = types.map((ty) => ({
      id: ty.id,
      name: ty.name,
      counted: ty.counts_toward_limit,
      requiresCustomLabel: ty.requires_custom_label,
      retired: false,
    }));
    if (editing && !types.some((ty) => ty.id === editing.break_type.id)) {
      list.push({
        id: editing.break_type.id,
        name: t("entry.retiredType", { name: editing.break_type.name }),
        counted: editing.counts_toward_limit,
        requiresCustomLabel: editing.break_type.requires_custom_label,
        retired: true,
      });
    }
    return list;
  }, [types, editing, t]);

  const minDate = oldestWorkDate ?? (today ? retentionMinDate(today.work_date) : null);
  const minInput = minDate ? `${minDate}T00:00` : undefined;
  const maxInput = isoToLocalInput(toIsoWithOffset(new Date()));

  function patch(next: Partial<BreakFormState>, clear: FieldKey[] = []) {
    setForm((f) => ({ ...f, ...next }));
    if (clear.length) {
      setFieldErrors((fe) => {
        const copy = { ...fe };
        for (const k of clear) delete copy[k];
        return copy;
      });
    }
    setFormError(null);
  }

  function validate(): boolean {
    const errs: Partial<Record<FieldKey, string>> = {};
    if (form.breakTypeId == null) errs.break_type_id = t("entry.missingFields");
    if (form.requiresCustomLabel && !cleanLabel(form.otherLabel)) {
      errs.other_label = t("errors.BREAK_CUSTOM_LABEL_REQUIRED");
    }
    const start = localInputToIso(form.startedAt);
    if (!start) errs.started_at = t("entry.missingFields");
    else if (new Date(start).getTime() > Date.now()) errs.started_at = t("errors.BREAK_STARTS_IN_FUTURE");
    if (!form.stillRunning) {
      const end = localInputToIso(form.endedAt);
      if (!end) errs.ended_at = t("entry.missingFields");
      else if (start && new Date(end).getTime() <= new Date(start).getTime()) {
        errs.ended_at = t("errors.BREAK_ENDS_BEFORE_START");
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function applyServerError(err: BreakError) {
    if (err.code === "BREAK_OUTSIDE_RETENTION_WINDOW" && err.oldestWorkDate) {
      setOldestWorkDate(err.oldestWorkDate);
    }
    // Laravel field errors → their fields.
    const fromServer: Partial<Record<FieldKey, string>> = {};
    for (const [k, v] of Object.entries(err.fieldErrors)) {
      if (k === "break_type_id" || k === "other_label" || k === "started_at" || k === "ended_at") {
        fromServer[k] = v;
      }
    }
    // Domain codes that belong to one field → that field.
    const field = fieldForCode(err.code) as FieldKey | null;
    if (field) fromServer[field] = errorText(err);

    if (Object.keys(fromServer).length) {
      setFieldErrors(fromServer);
      // Leftover field errors we can't place still need to be seen.
      const unplaced = Object.keys(err.fieldErrors).filter((k) => !(k in fromServer));
      if (unplaced.length) setFormError(err);
    } else {
      setFormError(err);
    }
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    setFormError(null);
    try {
      let saved: BreakEntry;
      if (editing) {
        const payload = buildUpdatePayload(editing, form);
        if (Object.keys(payload).length === 0) {
          toast.info(t("entry.nothingChanged"));
          onOpenChange(false);
          return;
        }
        saved = await update(editing.id, payload);
        toast.success(t("entry.updated"));
      } else {
        const payload = buildCreatePayload(form);
        if (!payload) {
          setFieldErrors({ break_type_id: t("entry.missingFields") });
          return;
        }
        saved = await create(payload);
        toast.success(t("entry.created"));
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "CANCELLED") return;
      if (e.code === "NOT_FOUND") {
        // Deleted elsewhere (or never ours) — nothing left to edit.
        toast.error(errorText(e));
        onOpenChange(false);
        return;
      }
      applyServerError(e);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (k: FieldKey) =>
    fieldErrors[k] ? (
      <p id={`break-${k}-error`} className="text-xs text-destructive">
        {fieldErrors[k]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("entry.editTitle") : t("entry.createTitle")}</DialogTitle>
          <DialogDescription>
            {editing ? t("entry.editDescription") : t("entry.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="break-type">{t("entry.type")}</Label>
            <BreakTypeCombobox
              id="break-type"
              options={options}
              value={form.breakTypeId}
              invalid={!!fieldErrors.break_type_id}
              describedBy={fieldErrors.break_type_id ? "break-break_type_id-error" : undefined}
              onChange={(opt) =>
                // Switching type clears the custom label; a non-custom type must not carry one.
                patch(
                  {
                    breakTypeId: opt.id,
                    requiresCustomLabel: opt.requiresCustomLabel,
                    otherLabel: opt.requiresCustomLabel ? form.otherLabel : "",
                  },
                  ["break_type_id", "other_label"]
                )
              }
            />
            {fieldError("break_type_id")}
          </div>

          {form.requiresCustomLabel && (
            <div className="space-y-1.5">
              <Label htmlFor="break-other-label">{t("timer.customLabel")}</Label>
              <Input
                id="break-other-label"
                value={form.otherLabel}
                maxLength={CUSTOM_LABEL_MAX}
                placeholder={t("timer.customLabelPlaceholder")}
                aria-invalid={!!fieldErrors.other_label}
                aria-describedby={fieldErrors.other_label ? "break-other_label-error" : undefined}
                onChange={(e) => patch({ otherLabel: e.target.value }, ["other_label"])}
              />
              {fieldError("other_label")}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="break-start">{t("entry.start")}</Label>
              <BreakDateTimeField
                id="break-start"
                value={form.startedAt}
                min={minInput}
                max={maxInput}
                invalid={!!fieldErrors.started_at}
                describedBy={fieldErrors.started_at ? "break-started_at-error" : undefined}
                onChange={(v) => patch({ startedAt: v }, ["started_at", "ended_at"])}
              />
              {fieldError("started_at")}
            </div>
            {!form.stillRunning && (
              <div className="space-y-1.5">
                <Label htmlFor="break-end">{t("entry.end")}</Label>
                <BreakDateTimeField
                  id="break-end"
                  value={form.endedAt}
                  min={form.startedAt || minInput}
                  max={maxInput}
                  invalid={!!fieldErrors.ended_at}
                  describedBy={fieldErrors.ended_at ? "break-ended_at-error" : undefined}
                  onChange={(v) => patch({ endedAt: v }, ["ended_at"])}
                />
                {fieldError("ended_at")}
              </div>
            )}
          </div>

          {/* Only an edit may be (or become) running; a manual entry always has both ends. */}
          {editing && (
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <Label htmlFor="break-still-running">{t("entry.stillRunning")}</Label>
                <p className="text-xs text-muted-foreground">{t("entry.stillRunningHint")}</p>
              </div>
              <Switch
                id="break-still-running"
                checked={form.stillRunning}
                onCheckedChange={(checked) => {
                  const end = form.endedAt || isoToLocalInput(toIsoWithOffset(new Date()));
                  patch({ stillRunning: checked, endedAt: end }, ["ended_at"]);
                }}
              />
            </div>
          )}

          {minDate && (
            <p className="text-xs text-muted-foreground">
              {t("entry.retentionHint", { date: formatWorkDate(minDate, true) })}
            </p>
          )}

          {formError && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError.code === "BREAK_OVERLAP" ? t("entry.overlapTitle") : errorText(formError)}
              </p>
              {formError.code === "BREAK_OVERLAP" && formError.conflicts?.length ? (
                <ul className="space-y-1 ps-6 text-xs text-foreground">
                  {formError.conflicts.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2 tabular-nums">
                      <span className="truncate font-medium">{c.label}</span>
                      <span className="text-muted-foreground">
                        {formatWorkDate(c.work_date)} · {formatTime(c.started_at)} –{" "}
                        {c.running ? t("today.running") : formatTime(c.ended_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("entry.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {saving ? t("entry.saving") : t("entry.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
