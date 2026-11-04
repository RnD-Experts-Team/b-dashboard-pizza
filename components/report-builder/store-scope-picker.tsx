"use client";

import { useEffect, useMemo } from "react";
import { Globe2, Store, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AllMultiSelect } from "@/components/toolbox-tickets/filter-multi-select";
import { useAuthStore } from "@/lib/auth/auth.store";
import { canUseAllStores, storesUsableFor, type ScopeStore } from "@/lib/report-builder/access";
import type { StoreMode, StoreScope } from "@/lib/report-builder/definition";
import type { CatalogDatasetRef } from "@/types/report-builder.types";

interface StoreScopePickerProps {
  value: StoreScope;
  onChange: (next: StoreScope) => void;
  /** The report's datasets — a store is offered only where all of them may be queried. */
  datasets: CatalogDatasetRef[];
  /** Code of the store selected in the topbar, used to start a "Pick stores" list. */
  selectedCode?: string;
  error?: string;
  disabled?: boolean;
}

const MODES: { mode: StoreMode; icon: typeof Globe2 }[] = [
  { mode: "mine", icon: Users },
  { mode: "list", icon: Store },
  { mode: "all", icon: Globe2 },
];

/**
 * Which stores the report covers: the caller's own (expanded by Data at run
 * time), an explicit list, or all stores (no list sent — the head-office
 * check, offered only when every dataset passes it).
 */
export function StoreScopePicker({ value, onChange, datasets, selectedCode, error, disabled }: StoreScopePickerProps) {
  const t = useTranslations("reportBuilder.stores");
  const tc = useTranslations("reportBuilder.common");
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const overviewStores = useAuthStore((s) => s.overviewStores);

  const stores = useMemo<ScopeStore[]>(
    () =>
      (overviewStores ?? []).flatMap((s) => (s.storeId ? [{ id: s.id, code: s.storeId, name: s.name || s.storeId }] : [])),
    [overviewStores],
  );
  const usable = useMemo(() => storesUsableFor(datasets, stores, canAccessRoute), [datasets, stores, canAccessRoute]);
  const allowAll = useMemo(() => canUseAllStores(datasets, canAccessRoute), [datasets, canAccessRoute]);

  const options = useMemo(
    () => usable.map((s) => ({ value: s.code, label: s.name, hint: s.code })),
    [usable],
  );
  const codes = value.mode === "list" ? value.codes : [];
  const usableCodes = useMemo(() => options.map((o) => o.value), [options]);

  // When the datasets change, the scope must still be one the caller may use for EVERY dataset:
  // "All stores" falls back to "My stores", and a list loses the stores that are no longer usable
  // (or falls back too when none is left). Skipped until there are datasets and stores to judge by.
  useEffect(() => {
    if (datasets.length === 0 || stores.length === 0) return;
    if (value.mode === "all" && !allowAll) {
      onChange({ mode: "mine" });
      return;
    }
    if (value.mode !== "list") return;
    const kept = value.codes.filter((c) => usableCodes.includes(c));
    if (kept.length === value.codes.length) return;
    onChange(kept.length > 0 ? { mode: "list", codes: kept } : { mode: "mine" });
  }, [datasets, stores, value, allowAll, usableCodes, onChange]);
  // AllMultiSelect draws `[]` as "every store"; in list mode that means every usable store.
  const everyUsable = usableCodes.length > 0 && usableCodes.every((c) => codes.includes(c)) && codes.length === usableCodes.length;

  const pickMode = (mode: StoreMode) => {
    if (mode === "list") {
      const start = selectedCode && usableCodes.includes(selectedCode) ? [selectedCode] : usableCodes;
      onChange({ mode: "list", codes: start });
      return;
    }
    onChange({ mode } as StoreScope);
  };

  const modeDisabled = (mode: StoreMode) => disabled || (mode === "all" && !allowAll) || (mode === "list" && usable.length === 0);

  return (
    <div data-slot="store-scope-picker" className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
        {MODES.map(({ mode, icon: Icon }) => {
          const active = value.mode === mode;
          const off = modeDisabled(mode);
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={off}
              onClick={() => pickMode(mode)}
              title={mode === "all" && !allowAll ? t("allDisabled") : undefined}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-2.5 text-start transition-colors",
                active ? "border-primary/50 bg-primary/5" : "hover:bg-accent",
                off && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(mode)}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{t(`${mode}Hint`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {value.mode === "list" && (
        <AllMultiSelect<string>
          options={options}
          selected={everyUsable ? [] : codes}
          onChange={(next) => onChange({ mode: "list", codes: next.length ? next : usableCodes })}
          allLabel={t("allUsable")}
          countLabel={(count) => t("count", { count })}
          searchPlaceholder={tc("search")}
          emptyText={tc("noResults")}
          disabled={disabled}
          aria-label={t("list")}
        />
      )}
      {!allowAll && datasets.length > 0 && <p className="text-[11px] text-muted-foreground">{t("allDisabled")}</p>}
      {datasets.length > 0 && usable.length === 0 && <p className="text-[11px] text-muted-foreground">{t("noneUsable")}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
