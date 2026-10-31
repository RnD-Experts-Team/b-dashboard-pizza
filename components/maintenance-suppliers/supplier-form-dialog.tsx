"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService, useSuppliers } from "@/lib/hooks/use-maintenance-catalog";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import type { Supplier, SupplierInput } from "@/types/maintenance-system";
import { DiscardChangesDialog } from "@/components/maintenance-technicians/discard-changes-dialog";
import { describedBy, focusFirstInvalid, FormField } from "@/components/maintenance-technicians/form-field";

/** The API's largest page (SupplierController: per_page ≤ 200). Deleted ones count: names stay taken. */
const NAME_CHECK_PAGE_SIZE = 200;
const ALL_NAMES = { withTrashed: true, perPage: NAME_CHECK_PAGE_SIZE } as const;

interface Draft {
  name: string;
  phone: string;
  website: string;
  description: string;
}

const draftOf = (s: Supplier | null): Draft => ({
  name: s?.name ?? "",
  phone: s?.phone ?? "",
  website: s?.website ?? "",
  description: s?.description ?? "",
});

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

const IDS = {
  name: "supplier-name",
  phone: "supplier-phone",
  website: "supplier-website",
  description: "supplier-description",
} as const;
type FieldKey = keyof typeof IDS;
const FIELD_ORDER = Object.keys(IDS) as FieldKey[];

/**
 * Add or edit a supplier — the same pattern as the technician dialog: the
 * name is checked while typed (deleted suppliers included) and again by the
 * server's 422; closing with typed data asks first.
 */
export function SupplierFormDialog({
  open,
  supplier,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  supplier: Supplier | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (supplier: Supplier) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const { suppliers: everyone } = useSuppliers(ALL_NAMES, open);
  const initial = useMemo(() => draftOf(supplier), [supplier]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setServerErrors({});
    setFormError(null);
  }, [open, initial]);

  const save = useMaintenanceMutation((input: SupplierInput) =>
    supplier ? maintenanceCatalogService.updateSupplier(supplier.id, input) : maintenanceCatalogService.createSupplier(input),
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const clash = findNameClash(draft.name, everyone, supplier?.id);
  const clientErrors: Partial<Record<FieldKey, string>> = clash
    ? { name: t("names.duplicateSupplier", { name: tidyName(clash.name) }) }
    : {};
  const errorOf = (key: FieldKey) => clientErrors[key] ?? serverErrors[key];

  function patch(key: FieldKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (serverErrors[key]) setServerErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function requestClose() {
    if (save.isPending) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  }

  const focusErrors = (errors: Partial<Record<FieldKey, string>>) =>
    focusFirstInvalid(formRef.current, FIELD_ORDER.map((k) => IDS[k]), Object.fromEntries(FIELD_ORDER.map((k) => [IDS[k], errors[k]])));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const required: Partial<Record<FieldKey, string>> = tidyName(draft.name) ? {} : { name: t("suppliers.nameRequired") };
    const errors = { ...clientErrors, ...required };
    if (Object.keys(errors).length > 0) {
      setServerErrors((prev) => ({ ...prev, ...required }));
      focusErrors(errors);
      return;
    }
    setFormError(null);
    try {
      const saved = await save.run({
        name: tidyName(draft.name),
        phone: orNull(draft.phone),
        website: orNull(draft.website),
        description: orNull(draft.description),
      });
      toast.success(supplier ? t("suppliers.saved", { name: saved.name }) : t("suppliers.added", { name: saved.name }));
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      const fields = getTicketsFieldErrors(err);
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in IDS)) as Partial<Record<FieldKey, string>>;
      setServerErrors(known);
      const unknown = Object.entries(fields).filter(([k]) => !(k in IDS)).map(([, msg]) => msg);
      const plain = err instanceof MaintenanceTicketsError && Object.keys(known).length === 0 ? err.message : t("common.saveError");
      setFormError(unknown[0] ?? plain);
      focusErrors(known);
    }
  }

  const submitLabel = supplier ? t("common.save") : t("technicians.addSupplier");

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{supplier ? t("suppliers.editTitle", { name: supplier.name }) : t("technicians.addSupplier")}</DialogTitle>
            <DialogDescription>{t("vocab.terms.supplier.help")}</DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
            <FormField id={IDS.name} label={t("common.name")} required error={errorOf("name")}>
              <Input
                id={IDS.name}
                value={draft.name}
                onChange={(e) => patch("name", e.target.value)}
                autoComplete="off"
                autoFocus
                aria-invalid={Boolean(errorOf("name"))}
                aria-describedby={describedBy(IDS.name, errorOf("name"))}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={IDS.phone} label={t("common.phone")} error={errorOf("phone")}>
                <Input
                  id={IDS.phone}
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => patch("phone", e.target.value)}
                  aria-invalid={Boolean(errorOf("phone"))}
                  aria-describedby={describedBy(IDS.phone, errorOf("phone"))}
                />
              </FormField>
              <FormField id={IDS.website} label={t("technicians.website")} error={errorOf("website")}>
                <Input
                  id={IDS.website}
                  type="url"
                  inputMode="url"
                  placeholder="example.com"
                  value={draft.website}
                  onChange={(e) => patch("website", e.target.value)}
                  aria-invalid={Boolean(errorOf("website"))}
                  aria-describedby={describedBy(IDS.website, errorOf("website"))}
                />
              </FormField>
            </div>
            <FormField id={IDS.description} label={t("common.description")} help={t("suppliers.descriptionHelp")} error={errorOf("description")}>
              <Textarea
                id={IDS.description}
                rows={3}
                value={draft.description}
                onChange={(e) => patch("description", e.target.value)}
                aria-invalid={Boolean(errorOf("description"))}
                aria-describedby={describedBy(IDS.description, errorOf("description"), true)}
              />
            </FormField>

            {formError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={save.isPending}>{t("common.cancel")}</Button>
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
    </>
  );
}
