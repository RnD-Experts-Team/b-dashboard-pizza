"use client";

import { useEffect, useMemo } from "react";
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
import { usePeriodOptions } from "@/lib/hooks/use-cleaning-periods";
import type { PeriodType } from "@/types/cleaning.types";

/**
 * The two-dropdown period selector shared by the Evaluation grid, My Store,
 * and Reports.
 *
 * Both the key list and the "current" default come from `GET
 * /cleaning/periods` — never computed locally (see the migration guide §4: a
 * local ISO-week key silently diverges from the backend's accounting-calendar
 * numbering on 2026-12-29). Switching the type clears the key; once the
 * server resolves that type's current period, this adopts it automatically,
 * so the pair is never left in an invalid combination. A fetch failure never
 * falls back to a locally computed key — the selector just shows its error
 * state instead (guide §4: a plausible-looking wrong key is worse than an
 * empty selector).
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
  const { options: periodOptions, current, loading, error } = usePeriodOptions(periodType);

  const options = useMemo(
    () => periodOptions.map((o) => ({ value: o.key, label: o.label })),
    [periodOptions]
  );

  // Adopt the server's current period whenever we don't have a key yet —
  // covers both first mount and a type switch (which clears the key below).
  useEffect(() => {
    if (periodKey || !current) return;
    onChange(periodType, current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey, current]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={periodType}
        onValueChange={(v) => onChange(v as PeriodType, "")}
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
        disabled={disabled || loading || (!loading && options.length === 0)}
        icon={<CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />}
        searchPlaceholder={t("evaluation.periodSearchPlaceholder")}
        emptyText={
          error ? t("evaluation.periodLoadError") : t("evaluation.periodSearchEmpty")
        }
        className="h-9 w-48"
      />
      {error && (
        <span className="text-xs text-destructive">{error.message}</span>
      )}
    </div>
  );
}
