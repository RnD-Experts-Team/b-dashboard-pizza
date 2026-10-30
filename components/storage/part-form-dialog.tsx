"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/maintenance-tickets/form-bits";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { useStorageWrites } from "@/lib/hooks/use-storage";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import { PART_UNITS, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import { useDiscardGuard, useResetOnOpen } from "./discard-guard";
import type { Part, PartInput, PartMeasureUnit } from "@/types/maintenance-v2";

/**
 * Add a part to the catalog, or edit one (catalog `POST parts` /
 * `PATCH parts/{part}`). The name is checked against the catalog while it is
 * typed — the same rule as the server (case and repeated spaces ignored) —
 * so "There is already a part called X" shows before Save, not after.
 */

interface FormState {
  name: string;
  unit: PartMeasureUnit;
  trackSerials: boolean;
  brand: string;
  model: string;
  partNumber: string;
  description: string;
}

function stateOf(part: Part | null | undefined): FormState {
  return {
    name: part?.name ?? "",
    unit: part?.unit ?? "each",
    trackSerials: part?.trackSerials ?? false,
    brand: part?.brand ?? "",
    model: part?.model ?? "",
    partNumber: part?.partNumber ?? "",
    description: part?.description ?? "",
  };
}

const orNull = (value: string) => value.trim() || null;

/** The API's 422 key for each field. */
const ERROR_KEY: Record<keyof FormState, string> = {
  name: "name",
  unit: "unit",
  trackSerials: "track_serials",
  brand: "brand",
  model: "model",
  partNumber: "part_number",
  description: "description",
};

export interface PartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set to edit; omit to add. */
  part?: Part | null;
  /** The catalog, for the live duplicate-name check. */
  catalog: readonly Part[];
  onSaved: (part: Part) => void;
}

export function PartFormDialog({ open, onOpenChange, part, catalog, onSaved }: PartFormDialogProps) {
  const t = useTranslations("maintenanceV2");
  const { createPart, updatePart } = useStorageWrites();
  const [form, setForm] = useState<FormState>(() => stateOf(part));
  const [initial, setInitial] = useState<FormState>(() => stateOf(part));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(part);
  const saving = createPart.isPending || updatePart.isPending;

  useResetOnOpen(open, () => {
    const next = stateOf(part);
    setForm(next);
    setInitial(next);
    setErrors({});
    setMoreOpen(Boolean(part?.description));
  });

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const guard = useDiscardGuard(dirty && !saving, () => onOpenChange(false));
  const clash = findNameClash(form.name, catalog, part?.id);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[ERROR_KEY[key]];
      return next;
    });
  }

  async function submit() {
    const name = tidyName(form.name);
    if (!name || clash) {
      setErrors({
        name: name ? t("names.duplicatePart", { name: clash?.name ?? name }) : t("storage.parts.nameRequired"),
      });
      nameRef.current?.focus();
      return;
    }
    const input: PartInput = {
      name,
      unit: form.unit,
      trackSerials: form.trackSerials,
      brand: orNull(form.brand),
      model: orNull(form.model),
      partNumber: orNull(form.partNumber),
      description: orNull(form.description),
    };
    try {
      const saved = part ? await updatePart.run(part.id, input) : await createPart.run(input);
      toast.success(isEdit ? t("storage.parts.updated", { name: saved.name }) : t("storage.parts.created", { name: saved.name }));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getTicketsFieldErrors(err);
      if (Object.keys(fields).length) {
        setErrors(fields);
        if (fields.name) nameRef.current?.focus();
        if (fields.description) setMoreOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : t("common.saveError"));
      }
    }
  }

  const nameError = errors.name ?? (clash ? t("names.duplicatePart", { name: clash.name }) : undefined);
  let submitLabel = isEdit ? t("common.save") : t("storage.parts.addPart");
  if (saving) submitLabel = t("common.saving");

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : guard.requestClose())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold">
              {isEdit ? t("storage.parts.editTitle") : t("storage.parts.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("storage.parts.formHelp")}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="part-name">
                {t("common.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="part-name"
                ref={nameRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(nameError)}
                aria-describedby="part-name-error"
                autoFocus
              />
              {nameError && (
                <p id="part-name-error" className="flex items-center gap-1 text-[11px] text-destructive">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {nameError}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="part-unit">{t("storage.parts.unit")}</Label>
                <Select value={form.unit} onValueChange={(v) => set("unit", v as PartMeasureUnit)}>
                  <SelectTrigger id="part-unit" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vocabOptions(PART_UNITS).map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {vocabText(t, u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{t("storage.parts.unitHelp")}</p>
                <FieldError message={errors.unit} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-number">{t("storage.parts.partNumber")}</Label>
                <Input id="part-number" value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} />
                <FieldError message={errors.part_number} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-brand">{t("storage.parts.brand")}</Label>
                <Input id="part-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                <FieldError message={errors.brand} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part-model">{t("storage.parts.model")}</Label>
                <Input id="part-model" value={form.model} onChange={(e) => set("model", e.target.value)} />
                <FieldError message={errors.model} />
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="part-serials">{t("storage.parts.trackSerials")}</Label>
                <p className="text-[11px] text-muted-foreground">{t("storage.parts.trackSerialsHelp")}</p>
                <FieldError message={errors.track_serials} />
              </div>
              <Switch id="part-serials" checked={form.trackSerials} onCheckedChange={(v) => set("trackSerials", v)} />
            </div>

            <div>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMoreOpen((v) => !v)}>
                {moreOpen ? <ChevronUp className="me-1 h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="me-1 h-3.5 w-3.5" aria-hidden="true" />}
                {moreOpen ? t("common.fewerDetails") : t("common.moreDetails")}
              </Button>
              {moreOpen && (
                <div className="mt-2 space-y-1.5">
                  <Label htmlFor="part-description">
                    {t("common.description")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                  </Label>
                  <Textarea
                    id="part-description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                  <FieldError message={errors.description} />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={guard.requestClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving || Boolean(clash)}>
                {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
