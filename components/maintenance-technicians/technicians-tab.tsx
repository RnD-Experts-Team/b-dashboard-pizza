"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, HardHat, Phone, Search, Siren, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTechnicianCategories, useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { formatMoney } from "@/lib/maintenance/money";
import type { Technician, TechnicianFilters } from "@/types/maintenance-v2";
import { StarValue } from "./star-rating";
import { useCatalogIssues } from "./use-catalog-issues";
import { usePaidByPayee } from "./use-paid-by-payee";
import { useQueryParams } from "./use-query-params";
import { useStoreNumberOptions } from "./use-store-options";

const ALL = "all";
/** One page holds every technician: the list is a catalog, tens of rows, not thousands. */
const LIST_PAGE_SIZE = 500;
/** Typing settles this long before the search goes into the URL and the request. */
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 6;

/** The query keys this tab owns. */
export const TECHNICIAN_QUERY_KEYS = ["q", "category", "store", "issue", "emergency"] as const;

export const EMERGENCY_BADGE =
  "inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";

/**
 * Technicians tab (docs/MAINTENANCE-V2-UI.md §7): one flat filter row —
 * search, category, store covered, issue covered, "Emergency only" — then the
 * list (a table on desktop, cards on a phone). Filters live in the URL.
 * With a store or an issue chosen the server ranks the list (covers store →
 * covers issue → call first → rating), so the order is the server's.
 */
export function TechniciansTab({ locale, onAdd, canAdd }: { locale: string; onAdd: () => void; canAdd: boolean }) {
  const t = useTranslations("maintenanceV2");
  const router = useRouter();
  const { get, set } = useQueryParams();
  const storeOptions = useStoreNumberOptions();
  const { categories } = useTechnicianCategories();
  const { issues } = useCatalogIssues();
  const paid = usePaidByPayee("thisMonth");

  const q = get("q");
  const category = get("category") || ALL;
  const store = get("store") || ALL;
  const issue = get("issue") || ALL;
  const emergency = get("emergency") === "1";

  const [search, setSearch] = useState(q);
  // The URL changed under us (Back, Clear all): the box follows it.
  const [urlQ, setUrlQ] = useState(q);
  if (q !== urlQ) {
    setUrlQ(q);
    setSearch(q);
  }
  useEffect(() => {
    if (search === q) return;
    const id = window.setTimeout(() => set({ q: search.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search, q, set]);

  const filters: TechnicianFilters = useMemo(
    () => ({
      search: q || undefined,
      categoryId: category === ALL ? undefined : Number(category),
      store: store === ALL ? undefined : store,
      issueId: issue === ALL ? undefined : Number(issue),
      emergency: emergency || undefined,
      perPage: LIST_PAGE_SIZE,
    }),
    [q, category, store, issue, emergency],
  );
  const { technicians, isLoading, isRefreshing, error, refresh } = useTechnicians(filters);

  const anyFilter = Boolean(q || category !== ALL || store !== ALL || issue !== ALL || emergency);
  const clearAll = () => set(Object.fromEntries(TECHNICIAN_QUERY_KEYS.map((k) => [k, null])));
  const open = (tech: Technician) => router.push(`/${locale}/dashboard/maintenance-technicians/${tech.id}`);
  const paidOf = (id: number) => (paid.byTechnician ? formatMoney(paid.byTechnician.get(id) ?? "0") : "—");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-3 shadow-sm" role="search">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("technicians.searchPlaceholder")}
            aria-label={t("technicians.searchLabel")}
            className="ps-8"
          />
        </div>
        <Select value={category} onValueChange={(v) => set({ category: v === ALL ? null : v })}>
          <SelectTrigger className="w-40" aria-label={t("common.category")}><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={ALL}>{t("technicians.allCategories")}</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={store} onValueChange={(v) => set({ store: v === ALL ? null : v })}>
          <SelectTrigger className="w-44" aria-label={t("technicians.storeCovered")}><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={ALL}>{t("technicians.anyStore")}</SelectItem>
            {storeOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={issue} onValueChange={(v) => set({ issue: v === ALL ? null : v })}>
          <SelectTrigger className="w-44" aria-label={t("technicians.issueCovered")}><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={ALL}>{t("technicians.anyIssue")}</SelectItem>
            {issues.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-1">
          <Switch id="technicians-emergency" checked={emergency} onCheckedChange={(v) => set({ emergency: v ? "1" : null })} />
          <label htmlFor="technicians-emergency" className="text-sm">{t("technicians.emergencyOnly")}</label>
        </div>
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="ms-auto">
            <X className="me-1 h-4 w-4" aria-hidden="true" />
            {t("common.clearAll")}
          </Button>
        )}
      </div>

      {(store !== ALL || issue !== ALL) && !error && (
        <p className="text-xs text-muted-foreground">{t("technicians.rankedNote")}</p>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error.message}
          </span>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("common.retry")}</Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label={t("technicians.loading")}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      )}

      {!isLoading && !error && technicians.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <HardHat className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {anyFilter ? t("technicians.noMatch") : t("technicians.emptyBody")}
          </p>
          {anyFilter ? (
            <Button variant="outline" onClick={clearAll}>{t("common.clearAll")}</Button>
          ) : (
            canAdd && <Button onClick={onAdd}>{t("technicians.addTechnician")}</Button>
          )}
        </div>
      )}

      {!isLoading && technicians.length > 0 && (
        <div className={cn("transition-opacity duration-200", isRefreshing && "opacity-60")}>
          {/* Desktop: the table. */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("common.name")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("common.category")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("common.phone")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground"><span className="sr-only">{t("technicians.standing.emergency")}</span></th>
                  <th scope="col" className="px-4 py-3 text-end font-medium text-muted-foreground">{t("technicians.storesCovered")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium text-muted-foreground">{t("technicians.issuesCovered")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium text-muted-foreground">{t("technicians.averageRating")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium text-muted-foreground">{t("technicians.paidThisMonth")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {technicians.map((tech) => (
                  <tr key={tech.id} onClick={() => open(tech)} className="cursor-pointer transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/dashboard/maintenance-technicians/${tech.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tech.name}
                      </Link>
                      {tech.contactPerson && <span className="block text-xs text-muted-foreground">{tech.contactPerson}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tech.category?.name ?? t("technicians.noCategory")}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {tech.phone ? (
                        <a href={`tel:${tech.phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{tech.phone}</a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tech.emergencyAvailable && (
                        <span className={EMERGENCY_BADGE}>
                          <Siren className="h-3 w-3" aria-hidden="true" />
                          {t("technicians.standing.emergency")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{tech.coverageStores?.length ?? 0}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{tech.coveredIssueCount ?? 0}</td>
                    <td className="px-4 py-3"><StarValue value={tech.averageRating} /></td>
                    <td className="px-4 py-3 text-end font-medium tabular-nums">{paidOf(tech.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: one card per technician. */}
          <ul className="space-y-2 md:hidden">
            {technicians.map((tech) => (
              <li key={tech.id}>
                <Link
                  href={`/${locale}/dashboard/maintenance-technicians/${tech.id}`}
                  className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tech.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[tech.category?.name ?? t("technicians.noCategory"), tech.contactPerson].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {tech.emergencyAvailable && (
                      <span className={EMERGENCY_BADGE}>
                        <Siren className="h-3 w-3" aria-hidden="true" />
                        {t("technicians.standing.emergency")}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      <span className="tabular-nums">{tech.phone ?? "—"}</span>
                    </span>
                    <StarValue value={tech.averageRating} className="justify-self-end text-xs" />
                    <span className="text-muted-foreground">
                      {t("technicians.storesCount", { count: tech.coverageStores?.length ?? 0 })} · {t("technicians.issuesCount", { count: tech.coveredIssueCount ?? 0 })}
                    </span>
                    <span className="justify-self-end font-medium tabular-nums">{paidOf(tech.id)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("technicians.paidThisMonthNote")}</p>
        </div>
      )}
    </div>
  );
}
