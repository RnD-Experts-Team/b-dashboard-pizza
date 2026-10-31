"use client";

import { useMemo } from "react";
import { MapPin, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { useStoreOptions } from "@/components/maintenance-payments/use-payment-lookups";
import { useIssueLookup } from "@/lib/hooks/use-issue-lookup";
import { TRIPPABLE_ISSUE_STATUSES } from "@/lib/maintenance-trips";
import { ISSUE_STATUSES, PRIORITIES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { nameKey } from "@/lib/maintenance/names";
import { cn } from "@/lib/utils";
import type { Priority, SchedulePurpose, TicketIssueLookupRow } from "@/types/maintenance-system";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Picking trip stops (New trip dialog, the drawer's Add stop)              */
/*                                                                            */
/*  Stores = every store the dashboard knows (so a store with no open        */
/*  ticket can be visited too) plus any place an open issue names. Open      */
/*  issues come from the issue lookup (`GET ticket-issues?statuses[]=`):     */
/*  the newest ones for the counts, and each chosen store's own list for     */
/*  the issues to tick.                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** The lookup's largest answer. */
const LOOKUP_LIMIT = 100;

export interface PlannerIssue {
  id: number;
  ticketId: number;
  title: string;
  status: string;
  priority: Priority | null;
}

export interface PlannerStore {
  /** "s:12" (numeric stores.id) or "o:Warehouse" (a place with no store). */
  key: string;
  storeId: number | null;
  storeNumber: string | null;
  storeName: string | null;
  otherStore: string | null;
  /** Open issues known from the newest-issues lookup (a store's own list may hold more). */
  issues: PlannerIssue[];
}

export interface StopDraft {
  key: string;
  storeId: number | null;
  storeNumber: string | null;
  otherStore: string | null;
  issueIds: number[];
  purpose: SchedulePurpose;
}

function toPlannerIssue(row: TicketIssueLookupRow): PlannerIssue {
  return { id: row.id, ticketId: row.ticketId, title: row.title, status: row.status, priority: row.priority?.value ?? null };
}

function keyOfRow(row: TicketIssueLookupRow): string | null {
  if (row.store) return `s:${row.store.id}`;
  return row.otherStore ? `o:${row.otherStore}` : null;
}

export function defaultPurpose(issues: readonly PlannerIssue[]): SchedulePurpose {
  return issues.length && issues.every((i) => i.status === "inspection") ? "inspection" : "work";
}

/** A new stop for a store: every issue known there ticked. */
export function draftFor(store: PlannerStore): StopDraft {
  return {
    key: store.key,
    storeId: store.storeId,
    storeNumber: store.storeNumber,
    otherStore: store.otherStore,
    issueIds: store.issues.map((i) => i.id),
    purpose: defaultPurpose(store.issues),
  };
}

/** A typed place with no store. */
export function otherDraft(name: string): StopDraft {
  return { key: `o:${name}`, storeId: null, storeNumber: null, otherStore: name, issueIds: [], purpose: "work" };
}

function byNumber(a: PlannerStore, b: PlannerStore): number {
  return (a.storeNumber ?? a.otherStore ?? "").localeCompare(b.storeNumber ?? b.otherStore ?? "", undefined, { numeric: true });
}

/**
 * Every store a stop can be for, filtered by `search` (store number, store
 * name, a place, or an open issue's title). Stores with open issues first.
 */
export function useTripStores(search: string) {
  const { stores: dashboardStores } = useStoreOptions();
  const lookup = useIssueLookup({ statuses: TRIPPABLE_ISSUE_STATUSES, limit: LOOKUP_LIMIT });

  const all = useMemo(() => {
    const byKey = new Map<string, PlannerStore>(
      dashboardStores.map((s) => [
        `s:${s.id}`,
        { key: `s:${s.id}`, storeId: s.id, storeNumber: s.storeNumber, storeName: s.name, otherStore: null, issues: [] },
      ]),
    );
    lookup.issues.forEach((row) => {
      const key = keyOfRow(row);
      if (!key) return;
      const store =
        byKey.get(key) ??
        ({
          key,
          storeId: row.store?.id ?? null,
          storeNumber: row.store?.storeNumber ?? null,
          storeName: null,
          otherStore: row.store ? null : row.otherStore,
          issues: [],
        } satisfies PlannerStore);
      store.issues.push(toPlannerIssue(row));
      byKey.set(key, store);
    });
    return [...byKey.values()].sort((a, b) => Number(!a.issues.length) - Number(!b.issues.length) || byNumber(a, b));
  }, [dashboardStores, lookup.issues]);

  const q = nameKey(search);
  const stores = useMemo(
    () =>
      q
        ? all.filter((s) =>
            [s.storeNumber, s.storeName, s.otherStore, ...s.issues.map((i) => i.title)].some((text) => nameKey(text).includes(q)),
          )
        : all,
    [all, q],
  );

  return { stores, all, isLoading: lookup.isLoading, error: lookup.error, refresh: lookup.refresh };
}

/* ── The store list ──────────────────────────────────────────────────────── */

export function StoreChoices({
  stores,
  chosen,
  loading,
  failed,
  onRetry,
  onToggle,
}: {
  stores: PlannerStore[];
  chosen: ReadonlySet<string>;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onToggle: (store: PlannerStore) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  if (loading && !stores.length) {
    return (
      <div className="space-y-1 p-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }
  return (
    <>
      {failed && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          {t("trips.newTripDialog.issuesLoadError")}
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {!stores.length ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{t("trips.newTripDialog.noStoreMatch")}</p>
      ) : (
        <ul className="divide-y">
          {stores.map((store) => {
            const on = chosen.has(store.key);
            const Icon = store.storeNumber ? Store : MapPin;
            return (
              <li key={store.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(store)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition-colors hover:bg-muted/40",
                    on && "bg-accent",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="shrink-0 font-medium">
                    {store.storeNumber ? t("trips.storeN", { number: store.storeNumber }) : store.otherStore}
                  </span>
                  {store.storeName && <span className="min-w-0 truncate text-muted-foreground">{store.storeName}</span>}
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {store.issues.length
                      ? t("trips.newTripDialog.openIssues", { count: store.issues.length })
                      : t("trips.newTripDialog.noOpenTickets")}
                  </span>
                  <span className="ms-auto shrink-0 text-[11px] text-primary">
                    {on ? t("trips.newTripDialog.added") : t("common.add")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ── One stop's issues to tick ───────────────────────────────────────────── */

/**
 * The open issues at a stop's store (its own lookup, so older ones the
 * newest-issues list missed show too), each with a tick. A typed place has
 * only the issues already known for it.
 */
export function StopIssueList({
  stop,
  known,
  onChange,
}: {
  stop: StopDraft;
  /** Issues already known for this place (the store list's). */
  known: readonly PlannerIssue[];
  onChange: (issueIds: number[]) => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const own = useIssueLookup(
    stop.storeNumber ? { store: stop.storeNumber, statuses: TRIPPABLE_ISSUE_STATUSES, limit: LOOKUP_LIMIT } : null,
  );
  const issues = useMemo(() => {
    const listed = own.issues.map(toPlannerIssue);
    return [...listed, ...known.filter((k) => !listed.some((i) => i.id === k.id))];
  }, [own.issues, known]);

  if (own.isLoading && !issues.length) return <Skeleton className="h-7 w-full" />;
  if (!issues.length) return <p className="px-1 text-[11px] text-muted-foreground">{t("trips.newTripDialog.visitOnly")}</p>;

  return (
    <ul className="space-y-1">
      {issues.map((issue) => {
        const on = stop.issueIds.includes(issue.id);
        const priority = vocabEntry(PRIORITIES, issue.priority);
        const status = vocabEntry(ISSUE_STATUSES, issue.status);
        return (
          <li key={issue.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40">
              <Checkbox
                checked={on}
                onCheckedChange={(v) => onChange(v ? [...stop.issueIds, issue.id] : stop.issueIds.filter((id) => id !== issue.id))}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  #{issue.ticketId} · {issue.title}
                </span>
                <span className="ms-2 inline-flex flex-wrap items-center gap-2 text-muted-foreground">
                  {status && vocabText(t, status)}
                  {priority && <PriorityChip value={priority.value} label={vocabText(t, priority)} prefix="" />}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
