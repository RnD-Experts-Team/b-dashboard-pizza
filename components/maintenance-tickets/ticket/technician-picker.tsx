"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTechnicianCategories, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { TechnicianCheckList } from "../technician-check-list";

const ALL = "all";
const PICKER_PAGE_SIZE = 100;

/**
 * The ranked technician picker for booking (UI doc §2): the server ranks
 * those who cover the store or the issue (covers store → covers issue →
 * emergency when urgent → call first → ★), each row with its badges. A
 * category filter narrows it; "Show everyone" lists every technician when
 * nobody on the ranked list fits.
 */
export function TechnicianPicker({
  storeNumber,
  catalogIssueId,
  urgent,
  value,
  onChange,
  invalid,
  id,
}: {
  storeNumber: string | null;
  catalogIssueId: number | null;
  urgent: boolean;
  value: number | null;
  onChange: (technicianId: number) => void;
  invalid?: boolean;
  id?: string;
}) {
  const t = useTranslations("maintenanceV2.tickets.picker");
  const [category, setCategory] = useState<string>(ALL);
  const [everyone, setEveryone] = useState(false);
  const { categories } = useTechnicianCategories();
  const canRank = Boolean(storeNumber || catalogIssueId);
  const ranked = canRank && !everyone;
  const { technicians, isLoading } = useTechnicians({
    ...(ranked ? { store: storeNumber ?? undefined, issueId: catalogIssueId ?? undefined, urgent } : {}),
    categoryId: category === ALL ? undefined : Number(category),
    perPage: PICKER_PAGE_SIZE,
  });

  return (
    <div className="space-y-2" id={id} tabIndex={-1} aria-invalid={invalid || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-44 text-xs" aria-label={t("category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canRank ? (
          <div className="ms-auto flex items-center gap-2">
            <Switch id={`${id ?? "picker"}-everyone`} checked={everyone} onCheckedChange={setEveryone} />
            <Label htmlFor={`${id ?? "picker"}-everyone`} className="text-xs font-normal text-muted-foreground">
              {t("showEveryone")}
            </Label>
          </div>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t("loading")}
        </div>
      ) : (
        <TechnicianCheckList
          technicians={technicians}
          selected={value ? [value] : []}
          onToggle={onChange}
          emptyText={ranked ? t("noneRanked") : t("none")}
        />
      )}
      {ranked ? <p className="text-xs text-muted-foreground">{t("rankedHelp")}</p> : null}
    </div>
  );
}
