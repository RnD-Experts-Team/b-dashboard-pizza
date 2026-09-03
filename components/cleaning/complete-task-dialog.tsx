"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import axios from "axios";
import { Loader2, RefreshCw, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import { employeeService } from "@/lib/api/services/employee.service";
import { MultiSelect, type MultiSelectOption } from "@/components/daily-pay/multi-select";
import { PhotoPicker } from "./photo-picker";
import type { DueItem } from "@/types/cleaning.types";

const ACTIVE_STATUSES = ["hired", "rehired"];

interface CompleteTaskFormProps {
  /** Human-readable store code (e.g. "03795-00003") for the employee lookup. */
  storeCode: string | null;
  date: string;
  item: DueItem;
  onComplete: (payload: {
    date: string;
    employeeIds: number[];
    note?: string;
    photos?: File[];
  }) => Promise<void>;
  /** Called after a successful submit, or when the user cancels. */
  onClose: () => void;
}

/**
 * The Complete-task form body — no Dialog wrapper, so the same fields can be
 * hosted either in a modal (CompleteTaskDialog, below) or embedded inline
 * (the floating Debrief widget's Cleaning Chart tab), matching the
 * "shared fields, host owns the chrome" pattern already used by TaskFormFields.
 */
export function CompleteTaskForm({ storeCode, date, item, onComplete, onClose }: CompleteTaskFormProps) {
  const t = useTranslations("cleaningChart.completeDialog");
  const [employees, setEmployees] = useState<MultiSelectOption<number>[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState(false);
  const [empRetryKey, setEmpRetryKey] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const photoRequired = item.photoRequired;
  const canSubmit = useMemo(
    () => selected.length > 0 && (!photoRequired || photos.length > 0) && !submitting,
    [selected, photoRequired, photos, submitting]
  );

  /* ── Fetch the store's active employees on mount (and on retry) ──
   * A failed fetch previously fell back to an empty list indistinguishable
   * from "this store has no active employees" — now it's surfaced as an
   * error with a way to try again, since silently emptying the picker left
   * the Complete button disabled with no clue why. */
  useEffect(() => {
    if (!storeCode) return;
    let cancelled = false;
    const controller = new AbortController();
    setEmpLoading(true);
    setEmpError(false);
    employeeService
      .getEmployeesAll(
        [storeCode],
        { status_in: ACTIVE_STATUSES, per_page: 100 },
        controller.signal
      )
      .then((res) => {
        if (cancelled) return;
        setEmployees(
          (res.data ?? []).map((emp) => ({
            value: Number(emp.id),
            label:
              [emp.first_name, emp.middle_name, emp.last_name]
                .filter(Boolean)
                .join(" ") || t("employeeFallback", { id: emp.id }),
            hint: emp.employment_type ?? undefined,
          }))
        );
      })
      .catch((err) => {
        if (cancelled || axios.isCancel(err)) return;
        setEmployees([]);
        setEmpError(true);
        toast.error(t("employeesLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setEmpLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storeCode, empRetryKey]);

  /* ── Ctrl+V paste an image while the form is open ── */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f != null);
      if (pasted.length > 0) {
        e.preventDefault();
        setPhotos((prev) => [...prev, ...pasted]);
        toast.success(t("toasts.pasted"));
      }
    },
    []
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onComplete({
        date,
        employeeIds: selected,
        note: note.trim() || undefined,
        photos,
      });
      toast.success(t("toasts.done", { label: item.label }));
      onClose();
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("toasts.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onPaste={handlePaste} className="space-y-4">
      {/* Employees */}
      <div className="space-y-2">
        <Label>
          {t("who")} <span className="text-destructive">*</span>
        </Label>
        <MultiSelect<number>
          options={employees}
          selected={selected}
          onChange={setSelected}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          placeholder={empLoading ? t("loadingEmployees") : t("selectEmployees")}
          searchPlaceholder={t("searchEmployees")}
          emptyText={empLoading ? t("loadingShort") : t("noEmployees")}
          disabled={empLoading}
        />
        {empError && !empLoading && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            {t("employeesLoadFailed")}
            <button
              type="button"
              onClick={() => setEmpRetryKey((k) => k + 1)}
              className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              {t("retry")}
            </button>
          </p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="cleaning-note">{t("note")}</Label>
        <Textarea
          id="cleaning-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          rows={2}
        />
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <Label>
          {t("photo")} {photoRequired && <span className="text-destructive">*</span>}
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            {t("photoHint")}
          </span>
        </Label>
        <PhotoPicker
          files={photos}
          onChange={setPhotos}
          required={photoRequired}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: number;
  /** Human-readable store code (e.g. "03795-00003") for the employee lookup. */
  storeCode: string | null;
  date: string;
  item: DueItem;
  onComplete: (payload: {
    date: string;
    employeeIds: number[];
    note?: string;
    photos?: File[];
  }) => Promise<void>;
}

export function CompleteTaskDialog({
  open,
  onOpenChange,
  storeCode,
  date,
  item,
  onComplete,
}: Props) {
  const t = useTranslations("cleaningChart.completeDialog");
  const photoRequired = item.photoRequired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { label: item.label })}</DialogTitle>
          <DialogDescription>
            {photoRequired ? t("descriptionWithPhoto") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <CompleteTaskForm
          storeCode={storeCode}
          date={date}
          item={item}
          onComplete={onComplete}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
