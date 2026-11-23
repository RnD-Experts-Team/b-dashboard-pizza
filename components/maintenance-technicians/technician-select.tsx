"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { EntityCombobox } from "@/components/maintenance-payments/entity-combobox";
import { useTechnicians } from "@/lib/hooks/use-maintenance-catalog";

const PAGE_SIZE = 3000;

/**
 * "Who did it": one technician (search by name), or nobody said. For stock
 * movements and parts used on a ticket, where naming the technician is
 * optional. A to Z.
 */
export function TechnicianSelect({ id, value, onChange }: { id?: string; value: number | null; onChange: (id: number | null) => void }) {
  const t = useTranslations("maintenanceSystem");
  const { technicians, isLoading } = useTechnicians({ perPage: PAGE_SIZE });
  const groups = useMemo(
    () => [
      {
        options: technicians
          .filter((tech) => !tech.deletedAt || tech.id === value)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((tech) => ({ value: String(tech.id), label: tech.name, hint: tech.category?.name ?? undefined })),
      },
    ],
    [technicians, value],
  );
  return (
    <EntityCombobox
      id={id}
      groups={groups}
      value={value == null ? null : String(value)}
      onChange={(v) => onChange(v == null ? null : Number(v))}
      placeholder={t("storage.record.nobody")}
      searchPlaceholder={t("technicians.search")}
      emptyText={t("payments.noMatches")}
      clearLabel={t("payments.clear")}
      loading={isLoading && !technicians.length}
    />
  );
}
