"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { hasActiveFilters, type PaymentsPageFilters } from "@/lib/maintenance-payments/filters-url";
import { LINE_TYPE_ORDER } from "@/lib/maintenance-payments/line-types";
import { PAYMENT_LINE_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { PaymentLineType, Supplier, Technician, TechnicianCategory } from "@/types/maintenance-system";
import { PaidToPicker } from "./paid-to-picker";
import type { StoreOption } from "./use-payment-lookups";

const ALL = "__all__";
const SEARCH_DEBOUNCE_MS = 400;

/** One flat filter row: dates, paid to, category, store, type, search, show mistakes. */
export function PaymentsFilters({
  filters,
  onChange,
  onClear,
  onRefresh,
  refreshing,
  technicians,
  suppliers,
  categories,
  stores,
}: {
  filters: PaymentsPageFilters;
  onChange: (patch: Partial<PaymentsPageFilters>) => void;
  onClear: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  technicians: Technician[];
  suppliers: Supplier[];
  categories: TechnicianCategory[];
  stores: StoreOption[];
}) {
  const t = useTranslations("maintenanceSystem");

  /* Search types freely and applies after a pause; an outside reset (Clear all) wins. */
  const [search, setSearch] = useState(filters.search);
  const [appliedSearch, setAppliedSearch] = useState(filters.search);
  if (appliedSearch !== filters.search) {
    setAppliedSearch(filters.search);
    setSearch(filters.search);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ search: value }), SEARCH_DEBOUNCE_MS);
  };

  return (
    <div className="flex flex-wrap items-end gap-2" role="search" aria-label={t("payments.filtersLabel")}>
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("payments.searchPlaceholder")}
          aria-label={t("common.search")}
          className="h-9 ps-8"
        />
      </div>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => onChange({ from: e.target.value })}
          aria-label={t("payments.fromDate")}
          className="h-9 w-[9.5rem] tabular-nums [color-scheme:light] dark:[color-scheme:dark]"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => onChange({ to: e.target.value })}
          aria-label={t("payments.toDate")}
          className="h-9 w-[9.5rem] tabular-nums [color-scheme:light] dark:[color-scheme:dark]"
        />
      </div>

      <div className="w-full sm:w-56">
        <PaidToPicker
          technicians={technicians}
          suppliers={suppliers}
          value={filters.paidTo}
          onChange={(choice) => onChange({ paidTo: choice ? { type: choice.type, id: choice.id } : null })}
          placeholder={t("payments.anyonePaid")}
          fallbackName={filters.paidTo ? `#${filters.paidTo.id}` : undefined}
        />
      </div>

      <Select
        value={filters.categoryId ? String(filters.categoryId) : ALL}
        onValueChange={(v) => onChange({ categoryId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label={t("payments.technicianCategory")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("payments.allCategories")}</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.store || ALL} onValueChange={(v) => onChange({ store: v === ALL ? "" : v })}>
        <SelectTrigger className="h-9 w-full sm:w-36" aria-label={t("common.store")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("payments.allStores")}</SelectItem>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.storeNumber}>
              {s.storeNumber}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type ?? ALL} onValueChange={(v) => onChange({ type: v === ALL ? null : (v as PaymentLineType) })}>
        <SelectTrigger className="h-9 w-full sm:w-40" aria-label={t("payments.lineType")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("payments.allTypes")}</SelectItem>
          {LINE_TYPE_ORDER.map((type) => (
            <SelectItem key={type} value={type}>
              {vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, type))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex h-9 items-center gap-2 px-1">
        <Switch id="pay-show-mistakes" checked={filters.showMistakes} onCheckedChange={(v) => onChange({ showMistakes: v })} />
        <Label htmlFor="pay-show-mistakes" className="text-xs">
          {t("common.showMistakes")}
        </Label>
      </div>

      <div className="flex items-center gap-1 sm:ms-auto">
        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={onClear}>
            <X className="size-3.5" />
            {t("common.clearAll")}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-9" onClick={onRefresh} aria-label={t("common.refresh")}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>
    </div>
  );
}
