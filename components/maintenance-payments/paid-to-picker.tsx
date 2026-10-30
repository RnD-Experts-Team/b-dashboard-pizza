"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maintenanceCatalogService } from "@/lib/hooks/use-maintenance-catalog";
import { useMaintenanceMutation } from "@/lib/hooks/use-maintenance-resource";
import { formErrorsFrom } from "@/lib/maintenance-payments/field-errors";
import type { PaidToChoice } from "@/lib/maintenance-payments/form-state";
import { findNameClash, tidyName } from "@/lib/maintenance/names";
import type { Supplier, Technician } from "@/types/maintenance-v2";
import { EntityCombobox, type ComboGroup } from "./entity-combobox";

const SEP = ":";

export function paidToValue(choice: { type: string; id: number } | null): string | null {
  return choice ? `${choice.type}${SEP}${choice.id}` : null;
}

/** The catalog's view of who is paid (name, hourly rate). */
export function paidToChoiceFrom(
  value: { type: string; id: number } | null,
  technicians: readonly Technician[],
  suppliers: readonly Supplier[],
): PaidToChoice | null {
  if (!value) return null;
  if (value.type === "technician") {
    const tech = technicians.find((x) => x.id === value.id);
    return tech ? { type: "technician", id: tech.id, name: tech.name, hourlyRate: tech.hourlyRate } : null;
  }
  const supplier = suppliers.find((x) => x.id === value.id);
  return supplier ? { type: "supplier", id: supplier.id, name: supplier.name } : null;
}

/**
 * "Paid to": one combobox over technicians and suppliers, grouped. With
 * `onSupplierCreated`, the footer adds a supplier inline (live duplicate
 * check, same rule as the server's: case and repeated spaces ignored).
 */
export function PaidToPicker({
  id,
  technicians,
  suppliers,
  value,
  onChange,
  onSupplierCreated,
  loading,
  invalid,
  disabled,
  placeholder,
  fallbackName,
}: {
  id?: string;
  technicians: readonly Technician[];
  suppliers: readonly Supplier[];
  value: { type: string; id: number } | null;
  onChange: (choice: PaidToChoice | null) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
  loading?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Shown while the catalog has not loaded the chosen one (or it was deleted). */
  fallbackName?: string;
}) {
  const t = useTranslations("maintenanceV2");

  const groups = useMemo<ComboGroup[]>(() => {
    const techOptions = technicians
      .filter((x) => !x.deletedAt || (value?.type === "technician" && value.id === x.id))
      .map((x) => ({ value: `technician${SEP}${x.id}`, label: x.name, hint: x.category?.name ?? undefined }));
    const supplierOptions = suppliers
      .filter((x) => !x.deletedAt || (value?.type === "supplier" && value.id === x.id))
      .map((x) => ({ value: `supplier${SEP}${x.id}`, label: x.name }));
    const known = [...techOptions, ...supplierOptions].some((o) => o.value === paidToValue(value));
    const missing = value && !known && fallbackName ? [{ value: paidToValue(value) as string, label: fallbackName }] : [];
    return [
      { label: t("payments.groupTechnicians"), options: [...(value?.type === "technician" ? missing : []), ...techOptions] },
      { label: t("payments.groupSuppliers"), options: [...(value?.type === "supplier" ? missing : []), ...supplierOptions] },
    ];
  }, [technicians, suppliers, value, fallbackName, t]);

  const pick = (raw: string | null) => {
    if (!raw) return onChange(null);
    const [type, idText] = raw.split(SEP);
    onChange(paidToChoiceFrom({ type, id: Number(idText) }, technicians, suppliers));
  };

  return (
    <EntityCombobox
      id={id}
      groups={groups}
      value={paidToValue(value)}
      onChange={pick}
      placeholder={placeholder ?? t("payments.paidToPlaceholder")}
      searchPlaceholder={t("payments.searchPaidTo")}
      emptyText={t("payments.noMatches")}
      clearLabel={t("payments.clear")}
      loading={loading}
      invalid={invalid}
      disabled={disabled}
      footer={
        onSupplierCreated
          ? (query, close) => (
              <AddSupplierInline
                initialName={query}
                suppliers={suppliers}
                onCreated={(supplier) => {
                  onSupplierCreated(supplier);
                  onChange({ type: "supplier", id: supplier.id, name: supplier.name });
                  close();
                }}
                onUseExisting={(supplier) => {
                  onChange({ type: "supplier", id: supplier.id, name: supplier.name });
                  close();
                }}
              />
            )
          : undefined
      }
    />
  );
}

/** "Add supplier" inside a picker's dropdown: just the name. */
export function AddSupplierInline({
  initialName,
  suppliers,
  onCreated,
  onUseExisting,
}: {
  initialName: string;
  suppliers: readonly Supplier[];
  onCreated: (supplier: Supplier) => void;
  onUseExisting: (supplier: Supplier) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMaintenanceMutation(maintenanceCatalogService.createSupplier);

  const clash = findNameClash(name, suppliers);

  if (!adding) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-primary"
        onClick={() => {
          setName(tidyName(initialName));
          setAdding(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        {initialName.trim() ? t("payments.addSupplierNamed", { name: tidyName(initialName) }) : t("payments.addSupplier")}
      </Button>
    );
  }

  const submit = async () => {
    const clean = tidyName(name);
    if (!clean || clash) return;
    setError(null);
    try {
      const supplier = await create.run({ name: clean });
      onCreated(supplier);
    } catch (err) {
      const parsed = formErrorsFrom(err, { rootFields: ["name"] });
      setError(parsed.fields.name ?? parsed.form[0] ?? null);
    }
  };

  return (
    <div className="space-y-1.5 p-1.5">
      <label htmlFor="pay-new-supplier" className="text-xs font-medium">
        {t("payments.newSupplierName")}
      </label>
      <div className="flex gap-1.5">
        <Input
          id="pay-new-supplier"
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          className="h-8 text-sm"
          aria-invalid={Boolean(clash || error) || undefined}
        />
        <Button type="button" size="sm" className="h-8" disabled={!tidyName(name) || Boolean(clash) || create.isPending} onClick={() => void submit()}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("common.add")}
        </Button>
      </div>
      {clash && (
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-destructive">
          {t("names.duplicateSupplier", { name: clash.name })}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onUseExisting(clash)}>
            {t("payments.useExisting", { name: clash.name })}
          </button>
        </p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
