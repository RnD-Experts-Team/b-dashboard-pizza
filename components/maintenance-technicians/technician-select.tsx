"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTechnicians } from "@/lib/hooks/use-maintenance-catalog";

const NOBODY = "none";
const PAGE_SIZE = 500;

/**
 * "Who did it": one technician, or nobody said. For stock movements and
 * parts used on a ticket, where naming the technician is optional.
 */
export function TechnicianSelect({ id, value, onChange }: { id?: string; value: number | null; onChange: (id: number | null) => void }) {
  const t = useTranslations("maintenanceSystem");
  const { technicians, isLoading } = useTechnicians({ perPage: PAGE_SIZE });
  return (
    <Select value={value == null ? NOBODY : String(value)} onValueChange={(v) => onChange(v === NOBODY ? null : Number(v))}>
      <SelectTrigger id={id} className="h-9" aria-label={t("storage.record.whoDidIt")} disabled={isLoading && !technicians.length}>
        <SelectValue placeholder={t("storage.record.nobody")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOBODY}>{t("storage.record.nobody")}</SelectItem>
        {technicians.map((tech) => (
          <SelectItem key={tech.id} value={String(tech.id)}>
            {tech.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
