"use client";

import { useDeferredValue, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldError, Segmented } from "@/components/maintenance-tickets/form-bits";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import type { SchedulePurpose, TripStopInput } from "@/types/maintenance-v2";
import { GuardedDialog } from "./guarded-dialog";
import { draftFor, otherDraft, StopIssueList, StoreChoices, useTripStores, type PlannerStore, type StopDraft } from "./stop-picker";

/**
 * Add stop (trip drawer): one store — any store, open tickets or not — or a
 * place typed in, the issues to do there, and work or inspection. A store
 * already on the trip gets the issues added to its visit.
 */
export function AddStopDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saves the stop; rejects with the server's refusal. */
  onAdd: (stop: TripStopInput) => Promise<void>;
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
    >
      <AddStopForm
        onDirty={() => setDirty(true)}
        onBusy={setBusy}
        onAdd={onAdd}
        onDone={() => {
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </GuardedDialog>
  );
}

type Errors = Partial<Record<"store" | "issues" | "form", string>>;

function AddStopForm({
  onDirty,
  onBusy,
  onAdd,
  onDone,
}: {
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
  onAdd: (stop: TripStopInput) => Promise<void>;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [search, setSearch] = useState("");
  const [other, setOther] = useState("");
  const [stop, setStop] = useState<StopDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const deferred = useDeferredValue(search);
  const { stores, all, isLoading, error: loadError, refresh } = useTripStores(deferred);
  const known = all.find((s) => s.key === stop?.key)?.issues ?? [];

  function choose(next: StopDraft | null): void {
    setStop(next);
    setErrors({});
    onDirty();
  }

  async function submit(): Promise<void> {
    if (!stop) {
      setErrors({ store: t("trips.addStop.pickStore") });
      return;
    }
    setBusy(true);
    onBusy(true);
    setErrors({});
    try {
      await onAdd({
        storeId: stop.storeId ?? undefined,
        otherStore: stop.storeId == null ? stop.otherStore ?? undefined : undefined,
        ticketIssueIds: stop.issueIds,
        purpose: stop.purpose,
      });
      onDone();
    } catch (err) {
      const fields = getTicketsFieldErrors(err);
      const next: Errors = { store: fields.store_id ?? fields.other_store, issues: fields.ticket_issue_ids };
      if (!next.store && !next.issues) next.form = err instanceof MaintenanceTicketsError ? err.message : t("common.saveError");
      setErrors(next);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading font-semibold">{t("trips.addStop.title")}</DialogTitle>
        <DialogDescription>{t("trips.addStop.help")}</DialogDescription>
      </DialogHeader>

      {stop ? (
        <div className="space-y-2 rounded-md border bg-card p-2.5">
          <div className="flex items-center gap-2">
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
              onChange={(purpose) => choose({ ...stop, purpose })}
            />
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("trips.addStop.change")} onClick={() => choose(null)}>
              <X aria-hidden="true" />
            </Button>
          </div>
          <StopIssueList stop={stop} known={known} onChange={(issueIds) => choose({ ...stop, issueIds })} />
          <FieldError message={errors.issues} />
        </div>
      ) : (
        <div className="space-y-1.5">
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
            <div className="max-h-56 overflow-y-auto">
              <StoreChoices
                stores={stores}
                chosen={new Set<string>()}
                loading={isLoading}
                failed={!!loadError}
                onRetry={() => void refresh()}
                onToggle={(store: PlannerStore) => choose(draftFor(store))}
              />
            </div>
            <div className="flex items-center gap-2 border-t p-2">
              <Input
                value={other}
                onChange={(e) => setOther(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && other.trim()) {
                    e.preventDefault();
                    choose(otherDraft(other.trim()));
                  }
                }}
                placeholder={t("trips.newTripDialog.somewhereElse")}
                aria-label={t("trips.newTripDialog.somewhereElse")}
                className="h-8 text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => choose(otherDraft(other.trim()))} disabled={!other.trim()}>
                <Plus aria-hidden="true" />
                {t("common.add")}
              </Button>
            </div>
          </div>
          <FieldError message={errors.store} />
        </div>
      )}

      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

      <DialogFooter>
        <Button type="submit" disabled={busy || !stop}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {busy ? t("common.saving") : t("trips.addStop.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
