"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardPaste, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import { VALUE_ACCENT } from "./cleaning-ui";
import { PhotoPicker } from "./photo-picker";
import type { ItemCell, ItemValue } from "@/types/cleaning.types";

const VERDICTS: ItemValue[] = ["pass", "fail", "auto_fail", "empty"];

export interface GradeTarget {
  storeId: number;
  store: string;
  itemId: number;
  itemName: string;
  cell: ItemCell;
}

/**
 * Grade modal for a single inspection-item cell — verdict + note + images.
 *
 * Inspection items always open this dialog (never a quick toggle); cleaning
 * chart chips are the opposite and never open a dialog at all.
 */
export function GradeItemDialog({
  target,
  onOpenChange,
  onSubmit,
}: {
  target: GradeTarget | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (args: {
    storeId: number;
    itemId: number;
    itemName: string;
    value: ItemValue;
    note: string;
    images: File[];
  }) => Promise<void>;
}) {
  const t = useTranslations("cleaningChart.gradeDialog");
  const tValue = useTranslations("cleaningChart.itemValue");
  const [value, setValue] = useState<ItemValue>("empty");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Re-seed whenever a different cell is opened.
  useEffect(() => {
    if (!target) return;
    setValue(target.cell.value);
    setNote(target.cell.note ?? "");
    setImages([]);
    setSaving(false);
  }, [target]);

  // Ctrl+V works anywhere in the dialog, not just while the photo picker
  // itself has focus — PhotoPicker's own paste handler stops propagation, so
  // this only fires for a paste that lands outside it (e.g. the note field).
  const handleDialogPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f != null);
    if (pasted.length > 0) {
      e.preventDefault();
      setImages((prev) => [...prev, ...pasted]);
      toast.success(t("photoPasted"));
    }
  };

  const handleSubmit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await onSubmit({
        storeId: target.storeId,
        itemId: target.itemId,
        itemName: target.itemName,
        value,
        note,
        images,
      });
      toast.success(t("saved", { item: target.itemName }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md" onPaste={handleDialogPaste}>
        <DialogHeader>
          <DialogTitle>{t("title", { item: target?.itemName ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("description", { store: target?.store ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Verdict */}
          <div className="space-y-1.5">
            <Label htmlFor="grade-verdict">
              {t("verdict")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={value}
              onValueChange={(v) => setValue(v as ItemValue)}
              disabled={saving}
            >
              <SelectTrigger id="grade-verdict" className="h-10">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("h-3.5 w-1 shrink-0 rounded-full", VALUE_ACCENT[value].bar)}
                    />
                    {tValue(value)}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VERDICTS.map((v) => (
                  <SelectItem key={v} value={v}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("h-3.5 w-1 shrink-0 rounded-full", VALUE_ACCENT[v].bar)}
                      />
                      {tValue(v)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("verdictHint")}</p>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="grade-note">{t("note")}</Label>
            <Textarea
              id="grade-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              rows={3}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label>{t("photos")}</Label>
            <PhotoPicker
              files={images}
              onChange={setImages}
              existing={target?.cell.photos ?? []}
              disabled={saving}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
              {t("pasteHint")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
