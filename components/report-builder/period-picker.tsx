"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { ReportPeriod } from "@/lib/report-builder/definition";
import { formatCell } from "@/lib/report-builder/format";
import { PERIOD_TOKENS, isPeriodToken, isSnapshot, resolvePeriod } from "@/lib/report-builder/periods";
import type { CatalogDatasetRef } from "@/types/report-builder.types";
import { formatIsoDate } from "@/lib/utils/date-range";

const FIXED = "fixed";

interface PeriodPickerProps {
  value: ReportPeriod;
  onChange: (next: ReportPeriod) => void;
  /** The report's datasets: snapshot ones ignore the period. */
  datasets: CatalogDatasetRef[];
  error?: string;
  disabled?: boolean;
}

/** A relative token (resolved when the run starts) or a fixed from/to range. */
export function PeriodPicker({ value, onChange, datasets, error, disabled }: PeriodPickerProps) {
  const t = useTranslations("reportBuilder.periods");
  const tc = useTranslations("reportBuilder.common");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const options = useMemo(
    () => [...PERIOD_TOKENS.map((tok) => ({ value: tok as string, label: t(tok) })), { value: FIXED, label: t("fixed") }],
    [t],
  );

  const selected = value.type === "fixed" ? FIXED : value.token;
  const range = resolvePeriod(value);
  const show = (iso: string) => (iso ? formatCell(iso, { type: "date" }, locale, { yes: "", no: "" }) : "…");

  const snapshotCount = datasets.filter(isSnapshot).length;
  const allSnapshots = datasets.length > 0 && snapshotCount === datasets.length;

  const pick = (v: string) => {
    if (isPeriodToken(v)) {
      onChange({ type: "relative", token: v });
      return;
    }
    // Start a custom range from what the current choice covers.
    const today = formatIsoDate(new Date());
    onChange({ type: "fixed", from: range.from || today, to: range.to || today });
  };

  if (allSnapshots) {
    return (
      <p data-slot="period-picker" className="text-xs text-muted-foreground">
        {t("snapshotNote")}
      </p>
    );
  }

  return (
    <div data-slot="period-picker" className="space-y-2">
      <SearchableSelect<string>
        options={options}
        value={selected}
        onChange={pick}
        disabled={disabled}
        searchPlaceholder={tc("search")}
        emptyText={tc("noResults")}
        icon={<CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />}
      />
      {value.type === "fixed" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{t("from")}</p>
            <DatePicker value={value.from} onChange={(from) => onChange({ ...value, from })} disabled={disabled} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{t("to")}</p>
            <DatePicker value={value.to} onChange={(to) => onChange({ ...value, to })} disabled={disabled} />
          </div>
        </div>
      )}
      <p className="text-xs tabular-nums">{t("resolved", { from: show(range.from), to: show(range.to) })}</p>
      {value.type === "relative" && <p className="text-[11px] text-muted-foreground">{t("resolvedHint")}</p>}
      {snapshotCount > 0 && <p className="text-[11px] text-muted-foreground">{t("snapshotNote")}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
