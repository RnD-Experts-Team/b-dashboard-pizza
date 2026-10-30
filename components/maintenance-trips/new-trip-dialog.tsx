"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Loader2, MapPin, Plus, Search, Store, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker, FieldError, Segmented } from "@/components/maintenance-tickets/form-bits";
import { PriorityChip } from "@/components/maintenance-tickets/ticket-chips";
import { TechnicianCheckList } from "@/components/maintenance-tickets/technician-check-list";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { maintenanceTripsService, usePlannerTickets } from "@/lib/hooks/use-maintenance-trips";
import { isTrippable, todayLocal } from "@/lib/maintenance-trips";
import { ISSUE_STATUSES, PRIORITIES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { cn } from "@/lib/utils";
import type { Priority, SchedulePurpose, TripPlannerTicket, TripWithLink } from "@/types/maintenance-v2";
import { GuardedDialog } from "./guarded-dialog";

/* ── Stores and their open issues, from the ticket list ─────────────────── */

interface PlannerIssue {
  id: number;
  ticketId: number;
  title: string;
  status: string;
  priority: Priority | null;
}

interface PlannerStore {
  /** "s:12" (store id) or "o:Warehouse" (a place with no store). */
  key: string;
  storeId: number | null;
  storeNumber: string | null;
  otherStore: string | null;
  issues: PlannerIssue[];
}

function groupByStore(tickets: readonly TripPlannerTicket[]): PlannerStore[] {
  const byKey = new Map<string, PlannerStore>();
  tickets.forEach((ticket) => {
    const storeId = ticket.storeId ?? ticket.store?.id ?? null;
    const key = storeId != null ? `s:${storeId}` : `o:${ticket.otherStore ?? ""}`;
    if (storeId == null && !ticket.otherStore) return;
    const row =
      byKey.get(key) ??
      ({
        key,
        storeId,
        storeNumber: ticket.store?.storeNumber ?? null,
        otherStore: storeId == null ? ticket.otherStore : null,
        issues: [],
      } satisfies PlannerStore);
    (ticket.issues ?? [])
      .filter((i) => isTrippable(i.status))
      .forEach((i) =>
        row.issues.push({
          id: i.id,
          ticketId: i.ticketId ?? ticket.id,
          title: i.displayTitle ?? i.title ?? `#${i.id}`,
          status: i.status,
          priority: i.assignedPriority?.value ?? i.priority?.value ?? null,
        }),
      );
    if (row.issues.length) byKey.set(key, row);
  });
  return [...byKey.values()].sort((a, b) =>
    (a.storeNumber ?? a.otherStore ?? "").localeCompare(b.storeNumber ?? b.otherStore ?? "", undefined, { numeric: true }),
  );
}

/* ── The dialog ──────────────────────────────────────────────────────────── */

interface StopDraft {
  key: string;
  storeId: number | null;
  storeNumber: string | null;
  otherStore: string | null;
  issueIds: number[];
  purpose: SchedulePurpose;
}

const TECH_PAGE_SIZE = 50;

/**
 * New trip (UI doc §3): technician (ranked for the first store), date, and
 * the stops — stores with their open issues, or a place typed in.
 * On success the parent shows the link once (Copy / Share).
 */
export function NewTripDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: TripWithLink) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <GuardedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDirty(false);
        onOpenChange(next);
      }}
      dirty={dirty}
      busy={busy}
      className="sm:max-w-2xl"
    >
      <NewTripForm
        onDirty={() => setDirty(true)}
        onBusy={setBusy}
        onCreated={(result) => {
          setDirty(false);
          onOpenChange(false);
          onCreated(result);
        }}
      />
    </GuardedDialog>
  );
}

type Errors = Partial<Record<"technician_id" | "planned_date" | "stops" | "form", string>>;

function NewTripForm({
  onDirty,
  onBusy,
  onCreated,
}: {
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
  onCreated: (result: TripWithLink) => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [date, setDate] = useState(todayLocal());
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [technicianId, setTechnicianId] = useState<number | null>(null);
  const [techSearch, setTechSearch] = useState("");
  const [instructions, setInstructions] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const first = stops[0] ?? null;
  const deferredTechSearch = useDeferredValue(techSearch);
  const { technicians, isLoading: techLoading } = useTechnicians({
    store: first?.storeNumber ?? undefined,
    search: deferredTechSearch || undefined,
    perPage: TECH_PAGE_SIZE,
  });

  function touch(): void {
    onDirty();
  }

  async function submit(): Promise<void> {
    const local: Errors = {};
    if (!technicianId) local.technician_id = t("trips.newTripDialog.pickTechnician");
    if (!date) local.planned_date = t("trips.newTripDialog.pickDate");
    if (Object.keys(local).length) {
      setErrors(local);
      document.getElementById(local.technician_id ? "new-trip-technician" : "new-trip-date")?.focus();
      return;
    }
    setBusy(true);
    onBusy(true);
    setErrors({});
    try {
      const result = await maintenanceTripsService.createTrip({
        technicianId: technicianId as number,
        plannedDate: date,
        instructions: instructions.trim() || null,
        stops: stops.map((s) => ({
          storeId: s.storeId ?? undefined,
          otherStore: s.storeId == null ? s.otherStore ?? undefined : undefined,
          ticketIssueIds: s.issueIds,
          purpose: s.purpose,
        })),
      });
      onCreated(result);
    } catch (err) {
      const fields = getTicketsFieldErrors(err);
      const stopsError = Object.entries(fields).find(([k]) => k.startsWith("stops"))?.[1];
      const next: Errors = {
        technician_id: fields.technician_id,
        planned_date: fields.planned_date,
        stops: stopsError,
      };
      if (!next.technician_id && !next.planned_date && !next.stops) {
        next.form = err instanceof MaintenanceTicketsError ? err.message : t("common.saveError");
      }
      setErrors(next);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading font-semibold">{t("trips.newTrip")}</DialogTitle>
        <DialogDescription>{t("trips.newTripDialog.help")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="new-trip-date">
          {t("common.date")}
          <span className="text-destructive"> *</span>
        </Label>
        <div id="new-trip-date" tabIndex={-1} className="max-w-56">
          <DatePicker
            value={date}
            onChange={(v) => {
              setDate(v);
              touch();
            }}
          />
        </div>
        <FieldError message={errors.planned_date} />
      </div>

      <StopsPicker
        stops={stops}
        onChange={(next) => {
          setStops(next);
          touch();
        }}
        error={errors.stops}
      />

      <div className="space-y-1.5">
        <Label htmlFor="new-trip-technician">
          {t("vocab.terms.technician.label")}
          <span className="text-destructive"> *</span>
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="new-trip-technician"
            value={techSearch}
            onChange={(e) => setTechSearch(e.target.value)}
            placeholder={t("trips.newTripDialog.searchTechnician")}
            className="ps-8"
            aria-invalid={!!errors.technician_id}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {first?.storeNumber
            ? t("trips.newTripDialog.rankedFor", { store: first.storeNumber })
            : t("trips.newTripDialog.rankedHint")}
        </p>
        {techLoading && !technicians.length ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <TechnicianCheckList
            technicians={technicians}
            selected={technicianId ? [technicianId] : []}
            onToggle={(id) => {
              setTechnicianId((cur) => (cur === id ? null : id));
              touch();
            }}
          />
        )}
        <FieldError message={errors.technician_id} />
      </div>

      {showMore ? (
        <div className="space-y-1.5">
          <Label htmlFor="new-trip-instructions">{t("trips.newTripDialog.instructions")}</Label>
          <Textarea
            id="new-trip-instructions"
            rows={3}
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              touch();
            }}
          />
          <p className="text-[11px] text-muted-foreground">{t("trips.newTripDialog.instructionsHelp")}</p>
        </div>
      ) : (
        <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setShowMore(true)}>
          {t("common.moreDetails")}
        </Button>
      )}

      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {busy ? t("common.saving") : t("trips.newTripDialog.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ── Stops picker ────────────────────────────────────────────────────────── */

function defaultPurpose(issues: readonly PlannerIssue[]): SchedulePurpose {
  return issues.length && issues.every((i) => i.status === "inspection") ? "inspection" : "work";
}

function StopsPicker({
  stops,
  onChange,
  error,
}: {
  stops: StopDraft[];
  onChange: (stops: StopDraft[]) => void;
  error?: string;
}) {
  const t = useTranslations("maintenanceV2");
  const [search, setSearch] = useState("");
  const [other, setOther] = useState("");
  const deferred = useDeferredValue(search);
  const { tickets, isLoading, error: loadError, refresh } = usePlannerTickets(deferred);
  const stores = useMemo(() => groupByStore(tickets), [tickets]);
  const chosen = new Set(stops.map((s) => s.key));

  function toggleStore(store: PlannerStore): void {
    if (chosen.has(store.key)) {
      onChange(stops.filter((s) => s.key !== store.key));
      return;
    }
    onChange([
      ...stops,
      {
        key: store.key,
        storeId: store.storeId,
        storeNumber: store.storeNumber,
        otherStore: store.otherStore,
        issueIds: store.issues.map((i) => i.id),
        purpose: defaultPurpose(store.issues),
      },
    ]);
  }

  function update(key: string, patch: Partial<StopDraft>): void {
    onChange(stops.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addOther(): void {
    const name = other.trim();
    if (!name) return;
    const key = `o:${name}`;
    if (!chosen.has(key)) {
      onChange([...stops, { key, storeId: null, storeNumber: null, otherStore: name, issueIds: [], purpose: "work" }]);
    }
    setOther("");
  }

  const storeByKey = new Map(stores.map((s) => [s.key, s]));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("trips.newTripDialog.stops")}</legend>
      <p className="text-[11px] text-muted-foreground">{t("trips.newTripDialog.stopsHelp")}</p>

      {!!stops.length && (
        <ol className="space-y-2">
          {stops.map((stop, index) => {
            const store = storeByKey.get(stop.key);
            return (
              <li key={stop.key} className="space-y-2 rounded-md border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">
                    {stop.storeNumber ? t("trips.storeN", { number: stop.storeNumber }) : stop.otherStore}
                  </span>
                  <Segmented<SchedulePurpose>
                    className="ms-auto"
                    value={stop.purpose}
                    options={[
                      { value: "work", label: t("trips.purposeWork") },
                      { value: "inspection", label: t("trips.purposeInspection") },
                    ]}
                    onChange={(purpose) => update(stop.key, { purpose })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("trips.newTripDialog.removeStop")}
                    onClick={() => onChange(stops.filter((s) => s.key !== stop.key))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {!!store?.issues.length && (
                  <ul className="space-y-1">
                    {store.issues.map((issue) => {
                      const on = stop.issueIds.includes(issue.id);
                      const priority = vocabEntry(PRIORITIES, issue.priority);
                      const status = vocabEntry(ISSUE_STATUSES, issue.status);
                      return (
                        <li key={issue.id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40">
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) =>
                                update(stop.key, {
                                  issueIds: v ? [...stop.issueIds, issue.id] : stop.issueIds.filter((id) => id !== issue.id),
                                })
                              }
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
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="rounded-md border">
        <div className="relative border-b">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("trips.newTripDialog.searchStores")}
            aria-label={t("trips.newTripDialog.searchStores")}
            className="rounded-none border-0 ps-8 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          <StoreChoices
            stores={stores}
            chosen={chosen}
            loading={isLoading}
            failed={!!loadError}
            onRetry={() => void refresh()}
            onToggle={toggleStore}
          />
        </div>
        <div className="flex items-center gap-2 border-t p-2">
          <Input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
            placeholder={t("trips.newTripDialog.somewhereElse")}
            aria-label={t("trips.newTripDialog.somewhereElse")}
            className="h-8 text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={addOther} disabled={!other.trim()}>
            <Plus aria-hidden="true" />
            {t("common.add")}
          </Button>
        </div>
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

function StoreChoices({
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
  const t = useTranslations("maintenanceV2");
  if (loading && !stores.length) {
    return (
      <div className="space-y-1 p-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
        {t("common.loadError")}
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!stores.length) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">{t("trips.newTripDialog.noOpenIssues")}</p>;
  }
  return (
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
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">
                {store.storeNumber ? t("trips.storeN", { number: store.storeNumber }) : store.otherStore}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {t("trips.newTripDialog.openIssues", { count: store.issues.length })}
              </span>
              <span className="ms-auto text-[11px] text-primary">
                {on ? t("trips.newTripDialog.added") : t("common.add")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
