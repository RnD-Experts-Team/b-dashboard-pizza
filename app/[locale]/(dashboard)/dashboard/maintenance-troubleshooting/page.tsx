"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, LifeBuoy, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/use-auth";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import type { CatalogIssue, TroubleshootingLibraryItem } from "@/types/maintenance-tickets.types";

function times(n: number): string {
  return n === 1 ? "once" : `${n} times`;
}

/**
 * The troubleshooting library: every issue that has guides -- what to try
 * before calling for an Oven, a Walk-in Cooler, the POS -- one guide per
 * specific problem. Each issue opens its own troubleshooting page, the same
 * page a store sees when it picks that issue on a new ticket.
 *
 * Catalog managers write guides on those pages; here they can start one for
 * an issue that has none.
 */
export default function MaintenanceTroubleshootingPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();
  const { canAccessRoute } = useAuth();
  const canEdit = canAccessRoute({ service: "Maintenance", method: "POST", path: "/issues/placeholder/troubleshooting-guides" });
  const storeCode = useSelectedStoreStore((s) => s.selectedStore?.storeId);

  const [items, setItems] = useState<TroubleshootingLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogIssue[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await maintenanceTicketsService.getTroubleshootingLibrary(storeCode));
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not load the troubleshooting guides.");
    } finally {
      setIsLoading(false);
    }
  }, [storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    maintenanceTicketsService.getCatalogIssues(undefined, storeCode)
      .then((issues) => setCatalog(issues.filter((i) => !i.deletedAt)))
      .catch(() => setCatalog([]));
  }, [canEdit, storeCode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.description ?? "", ...item.guides.map((g) => g.title)].some((text) => text.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const withoutGuide = useMemo(() => {
    const has = new Set(items.map((i) => i.issueId));
    return catalog.filter((issue) => !has.has(issue.id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [catalog, items]);

  const pageOf = (issueId: number) => `/${locale}/dashboard/maintenance-troubleshooting/${issueId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Troubleshooting"
        description="What to try before opening a ticket, one guide per problem. The same page opens when you pick the issue on a new ticket."
      >
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues and problems…"
            className="w-64 ps-8"
          />
        </div>
      </PageHeader>

      {canEdit && withoutGuide.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" /> Write guides for an issue that has none
          </p>
          <Select value="" onValueChange={(id) => router.push(pageOf(Number(id)))}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choose an issue…" /></SelectTrigger>
            <SelectContent position="popper" style={{ maxHeight: 280, overflowY: "auto" }}>
              {withoutGuide.map((issue) => (
                <SelectItem key={issue.id} value={String(issue.id)}>{issue.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {!isLoading && error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <LifeBuoy className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No troubleshooting guides yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {canEdit ? "Choose an issue above to write the first one." : "Once guides are written, they will appear here."}
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No issue or problem mentions “{query}”.</p>
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => (
            <Link
              key={item.issueId}
              href={pageOf(item.issueId)}
              className="group flex flex-col rounded-xl border bg-card shadow-sm transition-colors duration-150 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-semibold">{item.title}</h2>
                  {item.description && <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground">
                  {item.guides.length === 1 ? "1 guide" : `${item.guides.length} guides`}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </header>
              <ul className="divide-y">
                {item.guides.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
                    <span className="text-sm font-medium">{g.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.stepsCount === 1 ? "1 step" : `${g.stepsCount} steps`}
                      {g.fixedCount > 0 ? ` · fixed it ${times(g.fixedCount)}` : ""}
                      {g.notFixedCount > 0 ? ` · didn't fix ${times(g.notFixedCount)}` : ""}
                      {" · updated "}
                      <LocalTimestamp iso={g.updatedAt} pattern="MMM d, yyyy" showZone={false} />
                    </span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
