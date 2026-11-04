"use client";

import { useMemo, useState } from "react";
import { Database, Plus, Search, Weight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/lib/auth/auth.store";
import { usableDatasets } from "@/lib/report-builder/access";
import { isSnapshot } from "@/lib/report-builder/periods";
import type { DatasetRef } from "@/lib/report-builder/definition";
import type { CatalogDatasetRef } from "@/types/report-builder.types";

interface DatasetPickerProps {
  /** The whole catalog, flattened; access is applied here. */
  datasets: CatalogDatasetRef[];
  selected: DatasetRef[];
  /** Numeric store id the access probe runs for (`effectiveStoreId`). */
  storeId?: string;
  onAdd: (dataset: CatalogDatasetRef) => void;
  onRemove: (alias: string) => void;
  disabled?: boolean;
}

/**
 * Pick datasets, grouped by service. A dataset whose
 * `POST <path>` rule the caller fails at the effective store is not offered.
 */
export function DatasetPicker({ datasets, selected, storeId, onAdd, onRemove, disabled }: DatasetPickerProps) {
  const t = useTranslations("reportBuilder.datasets");
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const usable = useMemo(() => usableDatasets(datasets, canAccessRoute, storeId), [datasets, canAccessRoute, storeId]);
  const byKey = useMemo(() => new Map(datasets.map((d) => [d.key, d])), [datasets]);
  const chosen = useMemo(() => new Set(selected.map((s) => s.key)), [selected]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = usable.filter(
      (d) => !needle || d.label.toLowerCase().includes(needle) || d.key.toLowerCase().includes(needle),
    );
    const services = [...new Set(matches.map((d) => d.service))];
    return services.map((service) => ({ service, items: matches.filter((d) => d.service === service) }));
  }, [usable, query]);

  return (
    <div data-slot="dataset-picker" className="space-y-2">
      {selected.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
      <ul className="space-y-2">
        {selected.map((s) => {
          const ds = byKey.get(s.key);
          return (
            <li key={s.alias} className="flex items-start gap-2 rounded-lg border bg-card p-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-xs font-semibold text-primary">
                {s.alias}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{ds?.label ?? s.key}</span>
                  {ds && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {ds.service}
                    </Badge>
                  )}
                  {ds?.heavy && (
                    <Badge variant="outline" className="h-4 gap-0.5 px-1.5 text-[10px]">
                      <Weight className="h-2.5 w-2.5" />
                      {t("heavy")}
                    </Badge>
                  )}
                </div>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{s.key}</p>
                {ds && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("keys", { keys: ds.grain.join(" · ") })}
                    {isSnapshot(ds) && <> · {t("snapshot")}</>}
                  </p>
                )}
                {!ds && <p className="text-[11px] text-destructive">{t("missing")}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(s.alias)}
                disabled={disabled}
                aria-label={t("remove")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full border-dashed" disabled={disabled}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {t("add")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
            {usable.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("noAccess")}</p>}
            {usable.length > 0 && groups.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
            )}
            {groups.map((g) => (
              <div key={g.service} className="py-1">
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.service}
                </p>
                {g.items.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    disabled={chosen.has(d.key)}
                    onClick={() => {
                      onAdd(d);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{d.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {d.key} · {d.grain.join(" · ")}
                      </span>
                    </span>
                    {chosen.has(d.key) && <span className="shrink-0 text-[10px] text-muted-foreground">{t("added")}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
