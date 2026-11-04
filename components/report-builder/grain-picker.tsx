"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { GRAIN_KEYS } from "@/lib/report-builder/definition";
import { isSnapshot } from "@/lib/report-builder/periods";
import type { CatalogDatasetRef, GrainKey } from "@/types/report-builder.types";

interface GrainPickerProps {
  value: GrainKey[];
  onChange: (next: GrainKey[]) => void;
  /** The report's datasets: a key any of them lacks cannot be picked. */
  datasets: CatalogDatasetRef[];
  disabled?: boolean;
}

/**
 * One row per … store / date / employee, or none. Only keys every chosen
 * dataset has are offered (a key already picked stays visible so it can be
 * taken out).
 */
export function GrainPicker({ value, onChange, datasets, disabled }: GrainPickerProps) {
  const t = useTranslations("reportBuilder.grain");

  /** The datasets that cannot be reported by `key`: those lacking it, and for date the current-state ones. */
  const blockers = (key: GrainKey) =>
    datasets.filter((d) => !d.grain.includes(key) || (key === "date" && isSnapshot(d))).map((d) => d.label);
  const keys = GRAIN_KEYS.filter((key) => blockers(key).length === 0 || value.includes(key));

  const toggle = (key: GrainKey, on: boolean) => {
    const next = on ? [...value, key] : value.filter((k) => k !== key);
    // Keep the canonical order store → date → employee.
    onChange(GRAIN_KEYS.filter((k) => next.includes(k)));
  };

  return (
    <div data-slot="grain-picker" className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {keys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keys.map((key) => {
            const missing = blockers(key);
            const checked = value.includes(key);
            return (
              <label
                key={key}
                title={missing.length > 0 ? t("missing", { datasets: missing.join(", ") }) : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  checked && "border-primary/40 bg-primary/5",
                  disabled && !checked && "cursor-not-allowed opacity-50",
                  missing.length > 0 && "border-destructive/50",
                )}
              >
                <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => toggle(key, v === true)} />
                {t(key)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
