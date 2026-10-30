"use client";

import { useDeferredValue, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker, FieldError, Segmented } from "@/components/maintenance-tickets/form-bits";
import { TechnicianCheckList } from "@/components/maintenance-tickets/technician-check-list";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { useTechnicians } from "@/lib/hooks/use-maintenance-catalog";
import { maintenanceTripsService } from "@/lib/hooks/use-maintenance-trips";
import { todayLocal } from "@/lib/maintenance-trips";
import type { SchedulePurpose, TripWithLink } from "@/types/maintenance-v2";
import { GuardedDialog } from "./guarded-dialog";
import { draftFor, otherDraft, StopIssueList, StoreChoices, useTripStores, type PlannerStore, type StopDraft } from "./stop-picker";

/* ── The dialog ──────────────────────────────────────────────────────────── */

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
  const { stores, all, isLoading, error: loadError, refresh } = useTripStores(deferred);
  const chosen = new Set(stops.map((s) => s.key));
  const knownByKey = new Map(all.map((s) => [s.key, s.issues]));

  function toggleStore(store: PlannerStore): void {
    onChange(chosen.has(store.key) ? stops.filter((s) => s.key !== store.key) : [...stops, draftFor(store)]);
  }

  function update(key: string, patch: Partial<StopDraft>): void {
    onChange(stops.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addOther(): void {
    const name = other.trim();
    if (!name) return;
    if (!chosen.has(`o:${name}`)) onChange([...stops, otherDraft(name)]);
    setOther("");
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("trips.newTripDialog.stops")}</legend>
      <p className="text-[11px] text-muted-foreground">{t("trips.newTripDialog.stopsHelp")}</p>

      {!!stops.length && (
        <ol className="space-y-2">
          {stops.map((stop, index) => (
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
              <StopIssueList stop={stop} known={knownByKey.get(stop.key) ?? []} onChange={(issueIds) => update(stop.key, { issueIds })} />
            </li>
          ))}
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
