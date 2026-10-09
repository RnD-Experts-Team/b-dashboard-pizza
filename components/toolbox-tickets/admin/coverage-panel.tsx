"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArchiveRestore, CheckCircle2, CircleDashed, Loader2, Plus, Search, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { useAdminSections } from "@/lib/hooks/use-toolbox-tickets-admin";
import { FALLBACK_SECTION_KEY, SUGGESTED_AREA_NAMES, allReportKeys } from "@/lib/report-problem/pages";
import { parseTicketError } from "@/lib/toolbox-tickets/errors";
import { TicketsEmptyState, TicketsErrorState, TicketsListSkeleton } from "../tickets-states";
import { CatalogFormDialog, type CatalogFormValues } from "./catalog-form-dialog";
import type { TicketSection } from "@/types/toolbox-tickets.types";

type Status = "active" | "retired" | "missing";
type Filter = "all" | Status;

interface Row {
  key: string;
  section: TicketSection | null;
  status: Status;
  suggested: string;
}

const STATUS_STYLE: Record<Status, { icon: typeof CheckCircle2; badge: string }> = {
  active: {
    icon: CheckCircle2,
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  retired: {
    icon: ArchiveRestore,
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  missing: {
    icon: CircleDashed,
    badge: "border-red-500/30 bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  },
};

/**
 * Every area key the "Report a problem" button can send (lib/report-problem/
 * pages.ts) against the live catalogue. A key that doesn't exist upstream
 * makes reports from that part fall back to General — so each missing key
 * is one click to create, prefilled with its key and a suggested name, and a
 * retired one is one click to restore (re-creating it would be a duplicate).
 */
export function CoveragePanel({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations("toolboxTickets.admin.coverage");
  const { data, loading, error, reload } = useAdminSections();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState<Row | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byKey = new Map((data ?? []).map((s) => [s.key, s]));
    return allReportKeys().map((key) => {
      const section = byKey.get(key) ?? null;
      return {
        key,
        section,
        status: !section ? "missing" : section.active ? "active" : "retired",
        suggested: SUGGESTED_AREA_NAMES[key] ?? key,
      };
    });
  }, [data]);

  const counts = useMemo(
    () => ({
      active: rows.filter((r) => r.status === "active").length,
      retired: rows.filter((r) => r.status === "retired").length,
      missing: rows.filter((r) => r.status === "missing").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !q || r.key.includes(q) || (r.section?.name ?? r.suggested).toLowerCase().includes(q));
  }, [rows, query, filter]);

  const after = async (msg: string) => {
    toast.success(msg);
    await reload();
    onChanged();
  };

  const restore = async (row: Row) => {
    if (!row.section) return;
    setBusyKey(row.key);
    try {
      await toolboxTicketsService.updateSection(row.section.id, { active: true });
      await after(t("restored", { key: row.key }));
    } catch (err) {
      toast.error(parseTicketError(err, "admin").message);
    } finally {
      setBusyKey(null);
    }
  };

  const create = async (v: CatalogFormValues) => {
    try {
      await toolboxTicketsService.createSection({
        key: v.key,
        name: v.name,
        description: v.description || undefined,
        displayOrder: v.displayOrder ? Number(v.displayOrder) : undefined,
      });
    } catch (err) {
      // e.g. someone created it meanwhile — refresh so the row tells the truth.
      void reload();
      throw err;
    }
    await after(t("created", { key: v.key }));
  };

  if (error) return <TicketsErrorState error={error} onRetry={() => void reload()} />;

  const generalMissing = rows.some((r) => r.key === FALLBACK_SECTION_KEY && r.status !== "active");

  return (
    <div className="space-y-4" data-slot="tickets-coverage">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm font-medium tabular-nums">
          {t("summary", { active: counts.active, total: rows.length })}
        </p>
        {(["active", "retired", "missing"] as const).map((s) => (
          <Badge key={s} variant="outline" className={cn("gap-1 text-[10px] tabular-nums", STATUS_STYLE[s].badge)}>
            {t(`status.${s}`)} · {counts[s]}
          </Badge>
        ))}
      </div>

      {generalMissing && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{t("generalFirst", { key: FALLBACK_SECTION_KEY })}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="h-9 ps-8" />
        </div>
        <div className="w-full sm:w-44">
          <SearchableSelect<Filter>
            options={[
              { value: "all", label: t("filter.all") },
              { value: "missing", label: t("filter.missing"), hint: String(counts.missing) },
              { value: "retired", label: t("filter.retired"), hint: String(counts.retired) },
              { value: "active", label: t("filter.active"), hint: String(counts.active) },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      {loading && !data ? (
        <TicketsListSkeleton />
      ) : visible.length === 0 ? (
        <TicketsEmptyState icon={ShieldCheck} title={t("noMatches")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((row) => {
            const style = STATUS_STYLE[row.status];
            const Icon = style.icon;
            return (
              <li key={row.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      row.status === "active"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : row.status === "retired"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.section?.name ?? row.suggested}</p>
                    <code className="block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {row.key}
                    </code>
                    {row.key === FALLBACK_SECTION_KEY && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t("fallbackNote")}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px]", style.badge)}>
                    {t(`status.${row.status}`)}
                  </Badge>
                  {row.status === "missing" && (
                    <Button size="sm" className="h-8" onClick={() => setCreating(row)}>
                      <Plus className="me-1 h-3.5 w-3.5" />
                      {t("create")}
                    </Button>
                  )}
                  {row.status === "retired" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busyKey !== null}
                      onClick={() => void restore(row)}
                    >
                      {busyKey === row.key ? (
                        <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArchiveRestore className="me-1 h-3.5 w-3.5" />
                      )}
                      {t("restore")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CatalogFormDialog
        open={creating !== null}
        onOpenChange={(o) => !o && setCreating(null)}
        kind="section"
        initial={null}
        defaults={creating ? { key: creating.key, name: creating.suggested } : undefined}
        lockKey
        onSubmit={create}
        onError={() => undefined}
      />
    </div>
  );
}
