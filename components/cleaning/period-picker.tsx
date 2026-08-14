"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { buildPeriodOptions, currentPeriodKey } from "@/lib/cleaning/period-options";
import type { PeriodType } from "@/types/cleaning.types";

/**
 * The two-dropdown period selector shared by the Evaluation grid and Reports.
 *
 * Switching the type rebuilds the key list and immediately selects that type's
 * current period, so the pair is never left in an invalid combination (e.g. a
 * week key selected while the type says "date").
 */
export function PeriodPicker({
  periodType,
  periodKey,
  onChange,
  disabled,
}: {
  periodType: PeriodType;
  periodKey: string;
  onChange: (type: PeriodType, key: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("cleaningChart");
  const options = useMemo(() => buildPeriodOptions(periodType), [periodType]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={periodType}
        onValueChange={(v) => {
          const next = v as PeriodType;
          onChange(next, currentPeriodKey(next));
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-32 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">{t("evaluation.weekTab")}</SelectItem>
          <SelectItem value="date">{t("evaluation.dateTab")}</SelectItem>
        </SelectContent>
      </Select>

      <SearchableSelect
        options={options}
        value={periodKey}
        onChange={(v) => onChange(periodType, v)}
        disabled={disabled}
        icon={<CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />}
        searchPlaceholder={t("evaluation.periodSearchPlaceholder")}
        emptyText={t("evaluation.periodSearchEmpty")}
        className="h-9 w-48"
      />
    </div>
  );
}
