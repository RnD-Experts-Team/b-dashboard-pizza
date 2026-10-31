"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker, FieldError } from "@/components/maintenance-tickets/form-bits";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { isoToLocalInput, localInputToIso } from "@/lib/maintenance-trips";
import { TRIP_EVENT_KINDS, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { AddEventPayload, TripEvent, TripEventKind, UpdateEventPayload } from "@/types/maintenance-system";
import { GuardedDialog } from "./guarded-dialog";

type Errors = Partial<Record<"kind" | "at" | "reason" | "form", string>>;
const FIELDS = ["kind", "at", "reason"] as const;

/**
 * Add a break / driving / parts-run mark the technician forgot, or correct
 * the time of one. Reason required (audited).
 */
export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultAt,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = correct its time; absent = add one. */
  event: TripEvent | null;
  /** Where the time starts when adding (e.g. the session's clock in). */
  defaultAt?: string | null;
  onAdd: (payload: AddEventPayload) => Promise<unknown>;
  onUpdate: (eventId: number, payload: UpdateEventPayload) => Promise<unknown>;
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
      className="sm:max-w-md"
    >
      <EventForm
        event={event}
        defaultAt={defaultAt ?? null}
        onDirty={() => setDirty(true)}
        onBusy={setBusy}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDone={() => {
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </GuardedDialog>
  );
}

function EventForm({
  event,
  defaultAt,
  onDirty,
  onBusy,
  onAdd,
  onUpdate,
  onDone,
}: {
  event: TripEvent | null;
  defaultAt: string | null;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
  onAdd: (payload: AddEventPayload) => Promise<unknown>;
  onUpdate: (eventId: number, payload: UpdateEventPayload) => Promise<unknown>;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const [kind, setKind] = useState<TripEventKind | "">(event?.kind ?? "");
  const [at, setAt] = useState(isoToLocalInput(event?.at ?? defaultAt));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    const local: Errors = {};
    const atIso = localInputToIso(at);
    if (!event && !kind) local.kind = t("trips.event.kindNeeded");
    if (!atIso) local.at = t("trips.event.timeNeeded");
    if (!reason.trim()) local.reason = t("trips.reasonNeeded");
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    onBusy(true);
    setErrors({});
    try {
      if (event) await onUpdate(event.id, { at: atIso as string, reason: reason.trim() });
      else await onAdd({ kind: kind as TripEventKind, at: atIso as string, reason: reason.trim() });
      onDone();
    } catch (err) {
      const fields = getTicketsFieldErrors(err) as Errors;
      const next: Errors = { ...fields };
      if (!FIELDS.some((f) => fields[f])) {
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading font-semibold">
          {event ? t("trips.event.correctTitle") : t("trips.event.addTitle")}
        </DialogTitle>
        <DialogDescription>{t("trips.event.help")}</DialogDescription>
      </DialogHeader>

      {!event && (
        <div className="space-y-1.5">
          <Label htmlFor="event-kind">
            {t("trips.event.kind")}
            <span className="text-destructive"> *</span>
          </Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as TripEventKind);
              onDirty();
            }}
          >
            <SelectTrigger id="event-kind" className="w-full" aria-invalid={!!errors.kind}>
              <SelectValue placeholder={t("trips.event.pickKind")} />
            </SelectTrigger>
            <SelectContent>
              {vocabOptions(TRIP_EVENT_KINDS).map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {vocabText(t, entry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.kind} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>
          {t("common.time")}
          <span className="text-destructive"> *</span>
        </Label>
        <DateTimePicker
          value={at}
          onChange={(v) => {
            setAt(v);
            onDirty();
          }}
        />
        <FieldError message={errors.at} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-reason">
          {t("common.reason")}
          <span className="text-destructive"> *</span>
        </Label>
        <Textarea
          id="event-reason"
          rows={2}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            onDirty();
          }}
          aria-invalid={!!errors.reason}
        />
        <FieldError message={errors.reason} />
      </div>

      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
