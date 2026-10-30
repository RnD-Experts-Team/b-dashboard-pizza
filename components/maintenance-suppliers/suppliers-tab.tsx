"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Phone, Search, Store as StoreIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSuppliers } from "@/lib/hooks/use-maintenance-catalog";
import { formatMoney } from "@/lib/maintenance/money";
import type { Supplier, SupplierFilters } from "@/types/maintenance-v2";
import { useQueryParams } from "@/components/maintenance-technicians/use-query-params";
import { SupplierSheet, websiteHref } from "./supplier-sheet";

/** The API's largest page (SupplierController: per_page ≤ 200). */
const LIST_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 5;

/** The query keys this tab owns: `sq` (search) and `supplier` (the open sheet). */
export const SUPPLIER_QUERY_KEYS = ["sq", "supplier"] as const;

/**
 * Suppliers tab (docs/MAINTENANCE-V2-UI.md §7): search, then the list (name,
 * phone, website, total paid). A row opens the supplier's sheet — its id
 * goes in the URL (`?supplier=`) so the sheet can be linked to.
 *
 * "Total paid" comes on every list row (`total_paid`), so it shows for
 * people without access to the Finances report too.
 */
export function SuppliersTab({ locale, onAdd, canAdd, reloadKey }: { locale: string; onAdd: () => void; canAdd: boolean; reloadKey: number }) {
  const t = useTranslations("maintenanceV2");
  const { get, set } = useQueryParams();

  const q = get("sq");
  const openId = Number(get("supplier")) || null;

  const [search, setSearch] = useState(q);
  // The URL changed under us (Back, Clear all): the box follows it.
  const [urlQ, setUrlQ] = useState(q);
  if (q !== urlQ) {
    setUrlQ(q);
    setSearch(q);
  }
  useEffect(() => {
    if (search === q) return;
    const id = window.setTimeout(() => set({ sq: search.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search, q, set]);

  const filters: SupplierFilters = useMemo(() => ({ search: q || undefined, perPage: LIST_PAGE_SIZE }), [q]);
  const { suppliers, isLoading, isRefreshing, error, refresh } = useSuppliers(filters);

  // A supplier added or changed elsewhere on the page (the header's Add) reloads the list.
  useEffect(() => {
    if (reloadKey > 0) void refresh();
  }, [reloadKey, refresh]);

  const open = (s: Supplier) => set({ supplier: String(s.id) }, { push: true });
  // Every list row carries the total paid to the supplier so far (mistakes left out).
  const paidOf = (s: Supplier) => formatMoney(s.totalPaid ?? null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-3 shadow-sm" role="search">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("suppliers.searchPlaceholder")}
            aria-label={t("suppliers.searchLabel")}
            className="ps-8"
          />
        </div>
        {q && (
          <Button variant="ghost" size="sm" onClick={() => set({ sq: null })} className="ms-auto">
            <X className="me-1 h-4 w-4" aria-hidden="true" />
            {t("common.clearAll")}
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error.message}</span>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label={t("suppliers.loading")}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      )}

      {!isLoading && !error && suppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <StoreIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">{q ? t("suppliers.noMatch") : t("suppliers.emptyBody")}</p>
          {q ? (
            <Button variant="outline" onClick={() => set({ sq: null })}>{t("common.clearAll")}</Button>
          ) : (
            canAdd && <Button onClick={onAdd}>{t("technicians.addSupplier")}</Button>
          )}
        </div>
      )}

      {!isLoading && suppliers.length > 0 && (
        <div className={cn("transition-opacity duration-200", isRefreshing && "opacity-60")}>
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("common.name")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("common.phone")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("technicians.website")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium text-muted-foreground">{t("technicians.totalPaid")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suppliers.map((s) => (
                  <tr key={s.id} onClick={() => open(s)} className="cursor-pointer transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(s);
                        }}
                        className="rounded-sm text-start font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s.name}
                      </button>
                      {s.description && <span className="block max-w-md truncate text-xs text-muted-foreground">{s.description}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{s.phone}</a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      {s.website ? (
                        <a
                          href={websiteHref(s.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                        >
                          <span className="truncate">{s.website}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-medium tabular-nums">{paidOf(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {suppliers.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => open(s)}
                  className="block w-full rounded-xl border bg-card p-4 text-start shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{s.name}</p>
                    <span className="shrink-0 font-medium tabular-nums">{paidOf(s)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">{s.phone ?? "—"}</span>
                    {s.website && <span className="truncate">· {s.website}</span>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("suppliers.totalPaidNote")}</p>
        </div>
      )}

      <SupplierSheet
        locale={locale}
        supplierId={openId}
        canEdit={canAdd}
        onOpenChange={(next) => !next && set({ supplier: null })}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
