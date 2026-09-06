"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
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
import { MultiSelect } from "@/components/daily-pay/multi-select";
import { PhotoPicker } from "./photo-picker";
import type { CleaningEmployee, DueItem } from "@/types/cleaning.types";

interface CompleteTaskFormProps {
  /** The store's employees, as returned alongside the Due list — already
   *  scoped to whatever store/role permissions the caller has, so this form
   *  never fetches employees on its own (see the Hiring API 403 this
   *  replaced: the Cleaning Specialist role isn't granted the Hiring
   *  service's global /v1/employees endpoint, only the QA service's due
   *  endpoint that already embeds this list). */
  employees: CleaningEmployee[];
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
export function CompleteTaskForm({ employees, date, item, onComplete, onClose }: CompleteTaskFormProps) {
  const t = useTranslations("cleaningChart.completeDialog");
  const employeeOptions = useMemo(
    () => employees.map((emp) => ({ value: emp.id, label: emp.name })),
    [employees]
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const photoRequired = item.photoRequired;
  const canSubmit = useMemo(
    () => selected.length > 0 && (!photoRequired || photos.length > 0) && !submitting,
    [selected, photoRequired, photos, submitting]
  );

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
          options={employeeOptions}
          selected={selected}
          onChange={setSelected}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          placeholder={t("selectEmployees")}
          searchPlaceholder={t("searchEmployees")}
          emptyText={t("noEmployees")}
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
  /** The store's employees, as returned alongside the Due list — see the note on CompleteTaskFormProps. */
  employees: CleaningEmployee[];
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
  employees,
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
          employees={employees}
          date={date}
          item={item}
          onComplete={onComplete}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
