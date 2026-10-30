"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Settings2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/shared/multi-select";
import { cn } from "@/lib/utils";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService, useTechnicianCategories, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import { parseDecimal } from "@/lib/maintenance/money";
import type { Technician, TechnicianInput } from "@/types/maintenance-v2";
import { DiscardChangesDialog } from "./discard-changes-dialog";
import { describedBy, focusFirstInvalid, FormField } from "./form-field";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { useStoreNumberOptions } from "./use-store-options";

/** Every technician's name, deleted ones too: names stay taken after a delete. */
const NAME_CHECK_PAGE_SIZE = 1000;
const ALL_NAMES = { withTrashed: true, perPage: NAME_CHECK_PAGE_SIZE } as const;
const NO_CATEGORY = "none";

interface Draft {
  name: string;
  phone: string;
  categoryId: string;
  contactPerson: string;
  hourlyRate: string;
  location: string;
  emergencyAvailable: boolean;
  emergencyNotes: string;
  coverageStores: string[];
  coverageNotes: string;
}

function draftOf(t: Technician | null): Draft {
  return {
    name: t?.name ?? "",
    phone: t?.phone ?? "",
    categoryId: t?.categoryId ? String(t.categoryId) : NO_CATEGORY,
    contactPerson: t?.contactPerson ?? "",
    hourlyRate: t?.hourlyRate ?? "",
    location: t?.location ?? "",
    emergencyAvailable: t?.emergencyAvailable ?? false,
    emergencyNotes: t?.emergencyNotes ?? "",
    coverageStores: (t?.coverageStores ?? []).map((s) => s.storeNumber).sort(),
    coverageNotes: t?.coverageNotes ?? "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function toInput(d: Draft): TechnicianInput {
  return {
    name: tidyName(d.name),
    phone: orNull(d.phone),
    categoryId: d.categoryId === NO_CATEGORY ? null : Number(d.categoryId),
    contactPerson: orNull(d.contactPerson),
    hourlyRate: orNull(d.hourlyRate),
    location: orNull(d.location),
    emergencyAvailable: d.emergencyAvailable,
    emergencyNotes: orNull(d.emergencyNotes),
    coverageStores: d.coverageStores,
    coverageNotes: orNull(d.coverageNotes),
  };
}

/** Field ids, in the order the form shows them (the first invalid one gets focus). */
const IDS = {
  name: "technician-name",
  phone: "technician-phone",
  category_id: "technician-category",
  hourly_rate: "technician-rate",
  emergency_notes: "technician-emergency-notes",
  coverage_stores: "technician-stores",
  contact_person: "technician-contact",
  location: "technician-location",
  coverage_notes: "technician-coverage-notes",
} as const;
type FieldKey = keyof typeof IDS;
const FIELD_ORDER = Object.keys(IDS) as FieldKey[];
/** Fields that live behind "More details". */
const DETAIL_FIELDS: readonly FieldKey[] = ["contact_person", "location", "coverage_notes"];

/** `coverage_stores.3` → `coverage_stores`. */
function rootKey(key: string): string {
  return key.split(".")[0];
}

/**
 * Add or edit a technician (docs/MAINTENANCE-V2-UI.md §7). The essentials up
 * front, the rest behind "More details". The name is checked while it is
 * typed against every technician, deleted ones included (the backend's rule:
 * a deleted technician's name stays taken), and again by the server's 422.
 */
export function TechnicianFormDialog({
  open,
  technician,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = add a new one. */
  technician: Technician | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (technician: Technician) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const storeOptions = useStoreNumberOptions();
  const { technicians: everyone } = useTechnicians(ALL_NAMES, open);
  const categories = useTechnicianCategories(open);

  const initial = useMemo(() => draftOf(technician), [technician]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const bodyRef = useRef<HTMLFormElement>(null);

  // A fresh form every time the dialog opens (or opens on someone else).
  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setServerErrors({});
    setFormError(null);
    setShowMore(Boolean(initial.contactPerson || initial.location || initial.coverageNotes));
  }, [open, initial]);

  const save = useMaintenanceMutation((input: TechnicianInput) =>
    technician
      ? maintenanceCatalogService.updateTechnician(technician.id, input)
      : maintenanceCatalogService.createTechnician(input),
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const clash = findNameClash(draft.name, everyone, technician?.id);

  const clientErrors: Partial<Record<FieldKey, string>> = {};
  if (clash) clientErrors.name = t("names.duplicateTechnician", { name: tidyName(clash.name) });
  if (draft.hourlyRate.trim() !== "") {
    const rate = parseDecimal(draft.hourlyRate);
    if (rate == null || rate < 0) clientErrors.hourly_rate = t("technicians.hourlyRateInvalid");
  }
  const errorOf = (key: FieldKey): string | undefined => clientErrors[key] ?? serverErrors[key];

  function patch<K extends keyof Draft>(key: K, value: Draft[K], field?: FieldKey) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (field && serverErrors[field]) setServerErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function requestClose() {
    if (save.isPending) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const required: Partial<Record<FieldKey, string>> = tidyName(draft.name) ? {} : { name: t("technicians.nameRequired") };
    const errors = { ...clientErrors, ...required };
    if (Object.keys(errors).length > 0) {
      setServerErrors((prev) => ({ ...prev, ...required }));
      focusFirstInvalid(bodyRef.current, FIELD_ORDER.map((k) => IDS[k]), Object.fromEntries(FIELD_ORDER.map((k) => [IDS[k], errors[k]])));
      return;
    }
    setFormError(null);
    try {
      const saved = await save.run(toInput(draft));
      toast.success(technician ? t("technicians.saved", { name: saved.name }) : t("technicians.added", { name: saved.name }));
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      const fields = Object.fromEntries(
        Object.entries(getTicketsFieldErrors(err)).map(([k, msg]) => [rootKey(k), msg]),
      );
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in IDS));
      setServerErrors(known);
      const unknown = Object.entries(fields).filter(([k]) => !(k in IDS)).map(([, msg]) => msg);
      const plain = err instanceof MaintenanceTicketsError && Object.keys(known).length === 0 ? err.message : t("common.saveError");
      setFormError(unknown[0] ?? plain);
      if (Object.keys(known).some((k) => DETAIL_FIELDS.includes(k as FieldKey))) setShowMore(true);
      focusFirstInvalid(bodyRef.current, FIELD_ORDER.map((k) => IDS[k]), Object.fromEntries(FIELD_ORDER.map((k) => [IDS[k], known[k]])));
    }
  }

  const submitLabel = technician ? t("common.save") : t("technicians.addTechnician");
  const categoryList = categories.categories;
  // A category picked before the list arrived (or since deleted) still shows.
  const categoryMissing =
    draft.categoryId !== NO_CATEGORY && !categoryList.some((c) => String(c.id) === draft.categoryId);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {technician ? t("technicians.editTitle", { name: technician.name }) : t("technicians.addTechnician")}
            </DialogTitle>
            <DialogDescription>{t("vocab.terms.technician.help")}</DialogDescription>
          </DialogHeader>

          <form ref={bodyRef} onSubmit={submit} className="space-y-4" noValidate>
            <FormField id={IDS.name} label={t("common.name")} required help={t("technicians.nameHelp")} error={errorOf("name")}>
              <Input
                id={IDS.name}
                value={draft.name}
                onChange={(e) => patch("name", e.target.value, "name")}
                autoComplete="off"
                aria-invalid={Boolean(errorOf("name"))}
                aria-describedby={describedBy(IDS.name, errorOf("name"), true)}
                autoFocus
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={IDS.phone} label={t("common.phone")} error={errorOf("phone")}>
                <Input
                  id={IDS.phone}
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => patch("phone", e.target.value, "phone")}
                  aria-invalid={Boolean(errorOf("phone"))}
                  aria-describedby={describedBy(IDS.phone, errorOf("phone"))}
                />
              </FormField>
              <FormField id={IDS.hourly_rate} label={t("technicians.hourlyRate")} help={t("technicians.hourlyRateHelp")} error={errorOf("hourly_rate")}>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">$</span>
                  <Input
                    id={IDS.hourly_rate}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={draft.hourlyRate}
                    onChange={(e) => patch("hourlyRate", e.target.value, "hourly_rate")}
                    className="ps-7 tabular-nums"
                    aria-invalid={Boolean(errorOf("hourly_rate"))}
                    aria-describedby={describedBy(IDS.hourly_rate, errorOf("hourly_rate"), true)}
                  />
                </div>
              </FormField>
            </div>

            <FormField id={IDS.category_id} label={t("common.category")} error={errorOf("category_id")}>
              <div className="flex gap-2">
                <Select value={draft.categoryId} onValueChange={(v) => patch("categoryId", v, "category_id")}>
                  <SelectTrigger id={IDS.category_id} className="flex-1" aria-invalid={Boolean(errorOf("category_id"))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectItem value={NO_CATEGORY}>{t("technicians.noCategory")}</SelectItem>
                    {categoryMissing && <SelectItem value={draft.categoryId}>{technician?.category?.name ?? `#${draft.categoryId}`}</SelectItem>}
                    {categoryList.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setManagingCategories(true)}>
                  <Settings2 className="me-1.5 h-4 w-4" aria-hidden="true" />
                  {t("technicians.manageCategories")}
                </Button>
              </div>
            </FormField>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <label htmlFor="technician-emergency" className="text-sm font-medium">{t("technicians.emergencyAvailable")}</label>
                  <p className="text-xs text-muted-foreground">{t("technicians.emergencyAvailableHelp")}</p>
                </div>
                <Switch
                  id="technician-emergency"
                  checked={draft.emergencyAvailable}
                  onCheckedChange={(v) => patch("emergencyAvailable", v)}
                />
              </div>
              {draft.emergencyAvailable && (
                <FormField id={IDS.emergency_notes} label={t("technicians.emergencyNotes")} error={errorOf("emergency_notes")}>
                  <Textarea
                    id={IDS.emergency_notes}
                    rows={2}
                    value={draft.emergencyNotes}
                    onChange={(e) => patch("emergencyNotes", e.target.value, "emergency_notes")}
                    placeholder={t("technicians.emergencyNotesPlaceholder")}
                    aria-invalid={Boolean(errorOf("emergency_notes"))}
                    aria-describedby={describedBy(IDS.emergency_notes, errorOf("emergency_notes"))}
                  />
                </FormField>
              )}
            </div>

            <FormField id={IDS.coverage_stores} label={t("technicians.storesCovered")} help={t("technicians.storesCoveredHelp")} error={errorOf("coverage_stores")}>
              <div id={IDS.coverage_stores} tabIndex={-1} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MultiSelect<string>
                  options={storeOptions}
                  selected={draft.coverageStores}
                  onChange={(v) => patch("coverageStores", [...v].sort(), "coverage_stores")}
                  placeholder={t("technicians.pickStores")}
                  searchPlaceholder={t("technicians.searchStores")}
                  emptyText={t("technicians.noStoreMatch")}
                />
              </div>
              {draft.coverageStores.length > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">{draft.coverageStores.join(", ")}</p>
              )}
            </FormField>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ms-2 text-muted-foreground"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-controls="technician-more"
            >
              <ChevronDown className={cn("me-1 h-4 w-4 transition-transform", showMore && "rotate-180")} aria-hidden="true" />
              {showMore ? t("common.fewerDetails") : t("common.moreDetails")}
            </Button>

            {showMore && (
              <div id="technician-more" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id={IDS.contact_person} label={t("technicians.contactPerson")} help={t("technicians.contactPersonHelp")} error={errorOf("contact_person")}>
                    <Input
                      id={IDS.contact_person}
                      value={draft.contactPerson}
                      onChange={(e) => patch("contactPerson", e.target.value, "contact_person")}
                      aria-invalid={Boolean(errorOf("contact_person"))}
                      aria-describedby={describedBy(IDS.contact_person, errorOf("contact_person"), true)}
                    />
                  </FormField>
                  <FormField id={IDS.location} label={t("technicians.location")} help={t("technicians.locationHelp")} error={errorOf("location")}>
                    <Input
                      id={IDS.location}
                      value={draft.location}
                      onChange={(e) => patch("location", e.target.value, "location")}
                      aria-invalid={Boolean(errorOf("location"))}
                      aria-describedby={describedBy(IDS.location, errorOf("location"), true)}
                    />
                  </FormField>
                </div>
                <FormField id={IDS.coverage_notes} label={t("technicians.coverageNotes")} help={t("technicians.coverageNotesHelp")} error={errorOf("coverage_notes")}>
                  <Textarea
                    id={IDS.coverage_notes}
                    rows={2}
                    value={draft.coverageNotes}
                    onChange={(e) => patch("coverageNotes", e.target.value, "coverage_notes")}
                    aria-invalid={Boolean(errorOf("coverage_notes"))}
                    aria-describedby={describedBy(IDS.coverage_notes, errorOf("coverage_notes"), true)}
                  />
                </FormField>
              </div>
            )}

            {formError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={save.isPending}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {save.isPending ? t("common.saving") : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />

      <CategoryManagerDialog
        open={managingCategories}
        onOpenChange={setManagingCategories}
        onChanged={() => void categories.refresh()}
      />
    </>
  );
}
