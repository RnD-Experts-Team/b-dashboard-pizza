"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker, FieldError } from "@/components/maintenance-tickets/form-bits";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { getTicketsFieldErrors } from "@/lib/api/maintenance-tickets-errors";
import { isoToLocalInput, localInputToIso } from "@/lib/maintenance-trips";
import type { AddSessionPayload, TripSession, UpdateSessionPayload } from "@/types/maintenance-system";
import { GuardedDialog } from "./guarded-dialog";

type Errors = Partial<Record<"clock_in" | "clock_out" | "odometer_in" | "odometer_out" | "reason" | "form", string>>;

function toOdometer(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const FORM_FIELDS = ["clock_in", "clock_out", "odometer_in", "odometer_out", "reason"] as const;

/**
 * "Add session" (a clocked time the office types in) and "Correct" (fix the
 * times or odometer of one). Both need a reason — it goes in the audit list.
 */
export function SessionDialog({
  open,
  onOpenChange,
  session,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = Correct this session; absent = Add session. */
  session: TripSession | null;
  onAdd: (payload: AddSessionPayload) => Promise<unknown>;
  onUpdate: (sessionId: number, payload: UpdateSessionPayload) => Promise<unknown>;
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
      <SessionForm
        session={session}
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

function SessionForm({
  session,
  onDirty,
  onBusy,
  onAdd,
  onUpdate,
  onDone,
}: {
  session: TripSession | null;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
  onAdd: (payload: AddSessionPayload) => Promise<unknown>;
  onUpdate: (sessionId: number, payload: UpdateSessionPayload) => Promise<unknown>;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const [clockIn, setClockIn] = useState(isoToLocalInput(session?.clockIn));
  const [clockOut, setClockOut] = useState(isoToLocalInput(session?.clockOut));
  const [usingCar, setUsingCar] = useState(session?.usingCar ?? false);
  const [odoIn, setOdoIn] = useState(session?.odometerIn != null ? String(session.odometerIn) : "");
  const [odoOut, setOdoOut] = useState(session?.odometerOut != null ? String(session.odometerOut) : "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function change<V>(set: (v: V) => void) {
    return (v: V) => {
      set(v);
      onDirty();
    };
  }

  function focusFirst(found: Errors): void {
    const first = FORM_FIELDS.find((f) => found[f]);
    if (first) document.getElementById(`session-${first}`)?.focus();
  }

  async function submit(): Promise<void> {
    const local: Errors = {};
    const inIso = localInputToIso(clockIn);
    if (!inIso) local.clock_in = t("trips.session.clockInNeeded");
    if (!reason.trim()) local.reason = t("trips.reasonNeeded");
    if (Object.keys(local).length) {
      setErrors(local);
      focusFirst(local);
      return;
    }
    const base = {
      clockIn: inIso as string,
      clockOut: localInputToIso(clockOut),
      usingCar,
      odometerIn: usingCar ? toOdometer(odoIn) : null,
      odometerOut: usingCar ? toOdometer(odoOut) : null,
      reason: reason.trim(),
    };
    setBusy(true);
    onBusy(true);
    setErrors({});
    try {
      if (session) await onUpdate(session.id, base);
      else await onAdd(base);
      onDone();
    } catch (err) {
      const fields = getTicketsFieldErrors(err) as Errors;
      const known = FORM_FIELDS.some((f) => fields[f]);
      const next: Errors = { ...fields };
      if (!known) next.form = err instanceof MaintenanceTicketsError ? err.message : t("common.saveError");
      setErrors(next);
      focusFirst(next);
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
          {session ? t("trips.session.correctTitle") : t("trips.addSession")}
        </DialogTitle>
        <DialogDescription>
          {session ? t("trips.session.correctHelp") : t("trips.session.addHelp")}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="session-clock_in">
            {t("trips.session.clockIn")}
            <span className="text-destructive"> *</span>
          </Label>
          <div id="session-clock_in" tabIndex={-1}>
            <DateTimePicker value={clockIn} onChange={change(setClockIn)} placeholder={t("trips.session.pickTime")} />
          </div>
          <FieldError message={errors.clock_in} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="session-clock_out">{t("trips.session.clockOut")}</Label>
          <div id="session-clock_out" tabIndex={-1}>
            <DateTimePicker value={clockOut} onChange={change(setClockOut)} placeholder={t("trips.session.stillOn")} />
          </div>
          <FieldError message={errors.clock_out} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <Label htmlFor="session-using-car" className="text-sm font-normal">
          {t("trips.session.usingCar")}
        </Label>
        <Switch id="session-using-car" checked={usingCar} onCheckedChange={change(setUsingCar)} />
      </div>

      {usingCar && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="session-odometer_in">{t("trips.session.odometerIn")}</Label>
            <Input
              id="session-odometer_in"
              inputMode="numeric"
              className="tabular-nums"
              value={odoIn}
              onChange={(e) => change(setOdoIn)(e.target.value)}
              aria-invalid={!!errors.odometer_in}
            />
            <FieldError message={errors.odometer_in} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-odometer_out">{t("trips.session.odometerOut")}</Label>
            <Input
              id="session-odometer_out"
              inputMode="numeric"
              className="tabular-nums"
              value={odoOut}
              onChange={(e) => change(setOdoOut)(e.target.value)}
              aria-invalid={!!errors.odometer_out}
            />
            <FieldError message={errors.odometer_out} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="session-reason">
          {t("common.reason")}
          <span className="text-destructive"> *</span>
        </Label>
        <Textarea
          id="session-reason"
          rows={2}
          value={reason}
          onChange={(e) => change(setReason)(e.target.value)}
          aria-invalid={!!errors.reason}
        />
        <p className="text-[11px] text-muted-foreground">{t("common.reasonHelp")}</p>
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
