"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Loader2, Users, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import { employeeService } from "@/lib/api/services/employee.service";
import { MultiSelect, type MultiSelectOption } from "@/components/daily-pay/multi-select";
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
    photo?: File | null;
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
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const photoRequired = item.photoRequired;
  const canSubmit = useMemo(
    () => selected.length > 0 && (!photoRequired || !!photo) && !submitting,
    [selected, photoRequired, photo, submitting]
  );

  /* ── Fetch the store's active employees on mount ── */
  useEffect(() => {
    if (!storeCode) return;
    let cancelled = false;
    const controller = new AbortController();
    setEmpLoading(true);
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
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setEmpLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storeCode]);

  /* ── Photo preview object URL lifecycle ── */
  const applyPhoto = useCallback((file: File | null) => {
    setPhoto(file);
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ctrl+V paste an image while the form is open ── */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((it) => it.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        applyPhoto(file);
        toast.success(t("toasts.pasted"));
      }
    },
    [applyPhoto]
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onComplete({
        date,
        employeeIds: selected,
        note: note.trim() || undefined,
        photo,
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

      {/* Photo */}
      <div className="space-y-2">
        <Label>
          {t("photo")} {photoRequired && <span className="text-destructive">*</span>}
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            {t("photoHint")}
          </span>
        </Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => applyPhoto(e.target.files?.[0] ?? null)}
        />
        {photo && photoUrl ? (
          <div className="relative overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Selected"
              className="max-h-48 w-full bg-muted object-contain"
            />
            <div className="flex items-center justify-between gap-2 border-t bg-background/80 px-2 py-1.5">
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {photo.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => fileRef.current?.click()}
              >
                {t("replace")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  applyPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={cn("w-full", photoRequired && "border-dashed")}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="me-2 h-4 w-4" />
            {t("choosePhoto")}
          </Button>
        )}
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
    photo?: File | null;
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
