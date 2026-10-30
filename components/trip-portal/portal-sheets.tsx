"use client";

import { useState } from "react";
import { Check, LogIn, LogOut, MapPin, Send, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tripPortalService } from "@/lib/hooks/use-trip-portal";
import type { PublicTrip, TripStop, TripStopIssue } from "@/types/maintenance-v2";
import {
  BIG_INPUT,
  BIG_TEXTAREA,
  BigButton,
  BigChoice,
  BigField,
  PhotoField,
  PortalSheet,
  parseOdometer,
  usePortalErrorText,
} from "./portal-bits";

/** Runs one portal action (the hook's `act`): resolves with the refreshed trip. */
export type PortalRun = (fn: (token: string) => Promise<PublicTrip>) => Promise<PublicTrip>;

/** Busy + error for one sheet's submit, a success toast, then close. */
function useSheetSubmit(run: PortalRun, onDone: () => void) {
  const errorText = usePortalErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(fn: (token: string) => Promise<PublicTrip>, success: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await run(fn);
      toast.success(success);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, submit };
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-base font-medium text-destructive">
      {message}
    </p>
  );
}

/* ── Clock in / clock out ────────────────────────────────────────────────── */

export function ClockInSheet({ open, onOpenChange, run }: { open: boolean; onOpenChange: (o: boolean) => void; run: PortalRun }) {
  const t = useTranslations("maintenanceV2");
  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} title={t("tripPortal.buttons.clock_in")}>
      <ClockInForm run={run} onDone={() => onOpenChange(false)} />
    </PortalSheet>
  );
}

function ClockInForm({ run, onDone }: { run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const [car, setCar] = useState<"yes" | "no" | null>(null);
  const [odometer, setOdometer] = useState("");
  const [photo, setPhoto] = useState<File[]>([]);
  const { busy, error, setError, submit } = useSheetSubmit(run, onDone);

  return (
    <>
      <BigField label={t("tripPortal.usingCar")} required>
        <BigChoice
          label={t("tripPortal.usingCar")}
          value={car}
          onChange={setCar}
          options={[
            { value: "yes", label: t("tripPortal.yes") },
            { value: "no", label: t("tripPortal.no") },
          ]}
        />
      </BigField>
      {car === "yes" && (
        <>
          <BigField label={t("tripPortal.odometer")} htmlFor="clockin-odometer" help={t("tripPortal.odometerHelp")}>
            <Input
              id="clockin-odometer"
              inputMode="numeric"
              autoComplete="off"
              className={`${BIG_INPUT} tabular-nums`}
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
            />
          </BigField>
          <PhotoField label={t("tripPortal.odometerPhoto")} files={photo} onChange={setPhoto} multiple={false} />
        </>
      )}
      <FormError message={error} />
      <BigButton
        size="giant"
        icon={<LogIn aria-hidden="true" />}
        busy={busy}
        onClick={() => {
          if (!car) {
            setError(t("tripPortal.sayIfCar"));
            return;
          }
          void submit(
            (tok) =>
              tripPortalService.clockIn(tok, {
                usingCar: car === "yes",
                odometer: car === "yes" ? parseOdometer(odometer) : null,
                photo: car === "yes" ? photo[0] ?? null : null,
              }),
            t("tripPortal.clockedIn"),
          );
        }}
      >
        {t("tripPortal.buttons.clock_in")}
      </BigButton>
    </>
  );
}

export function ClockOutSheet({
  open,
  onOpenChange,
  run,
  usingCar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run: PortalRun;
  usingCar: boolean;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} title={t("tripPortal.buttons.clock_out")} description={t("tripPortal.clockOutHelp")}>
      <ClockOutForm run={run} usingCar={usingCar} onDone={() => onOpenChange(false)} />
    </PortalSheet>
  );
}

function ClockOutForm({ run, usingCar, onDone }: { run: PortalRun; usingCar: boolean; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const [odometer, setOdometer] = useState("");
  const [photo, setPhoto] = useState<File[]>([]);
  const { busy, error, submit } = useSheetSubmit(run, onDone);
  return (
    <>
      {usingCar && (
        <>
          <BigField label={t("tripPortal.odometer")} htmlFor="clockout-odometer" help={t("tripPortal.odometerHelp")}>
            <Input
              id="clockout-odometer"
              inputMode="numeric"
              autoComplete="off"
              className={`${BIG_INPUT} tabular-nums`}
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
            />
          </BigField>
          <PhotoField label={t("tripPortal.odometerPhoto")} files={photo} onChange={setPhoto} multiple={false} />
        </>
      )}
      <FormError message={error} />
      <BigButton
        size="giant"
        icon={<LogOut aria-hidden="true" />}
        busy={busy}
        onClick={() =>
          void submit(
            (tok) =>
              tripPortalService.clockOut(tok, {
                odometer: usingCar ? parseOdometer(odometer) : null,
                photo: usingCar ? photo[0] ?? null : null,
              }),
            t("tripPortal.clockedOut"),
          )
        }
      >
        {t("tripPortal.buttons.clock_out")}
      </BigButton>
    </>
  );
}

/* ── Arrive at a stop ────────────────────────────────────────────────────── */

export function ArriveSheet({
  stop,
  onClose,
  run,
  storeName,
}: {
  stop: TripStop | null;
  onClose: () => void;
  run: PortalRun;
  storeName: string;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <PortalSheet open={!!stop} onOpenChange={(o) => !o && onClose()} title={t("tripPortal.imHere")} description={storeName}>
      {stop && <ArriveForm stop={stop} run={run} onDone={onClose} />}
    </PortalSheet>
  );
}

function ArriveForm({ stop, run, onDone }: { stop: TripStop; run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const [odometer, setOdometer] = useState("");
  const [photo, setPhoto] = useState<File[]>([]);
  const { busy, error, submit } = useSheetSubmit(run, onDone);
  return (
    <>
      <BigField label={`${t("tripPortal.odometer")} (${t("common.optional")})`} htmlFor="arrive-odometer">
        <Input
          id="arrive-odometer"
          inputMode="numeric"
          autoComplete="off"
          className={`${BIG_INPUT} tabular-nums`}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
        />
      </BigField>
      <PhotoField label={`${t("tripPortal.odometerPhoto")} (${t("common.optional")})`} files={photo} onChange={setPhoto} multiple={false} />
      <FormError message={error} />
      <BigButton
        size="giant"
        icon={<MapPin aria-hidden="true" />}
        busy={busy}
        onClick={() =>
          void submit(
            (tok) => tripPortalService.arrive(tok, stop.id, { odometer: parseOdometer(odometer), photo: photo[0] ?? null }),
            t("tripPortal.arrived"),
          )
        }
      >
        {t("tripPortal.imHere")}
      </BigButton>
    </>
  );
}

/* ── A job done ──────────────────────────────────────────────────────────── */

export interface IssueTarget {
  stop: TripStop;
  issue: TripStopIssue;
}

export function IssueDoneSheet({ target, onClose, run }: { target: IssueTarget | null; onClose: () => void; run: PortalRun }) {
  const t = useTranslations("maintenanceV2");
  const inspection = target?.issue.purpose === "inspection";
  return (
    <PortalSheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={inspection ? t("tripPortal.inspectionDone") : t("tripPortal.jobDone")}
      description={target?.issue.title}
    >
      {target && <IssueDoneForm target={target} run={run} onDone={onClose} />}
    </PortalSheet>
  );
}

const DECIMAL_INPUT = "decimal";

function IssueDoneForm({ target, run, onDone }: { target: IssueTarget; run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const inspection = target.issue.purpose === "inspection";
  const [note, setNote] = useState("");
  const [findings, setFindings] = useState("");
  const [estimate, setEstimate] = useState("");
  const [before, setBefore] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { busy, error, submit } = useSheetSubmit(run, onDone);

  return (
    <>
      {inspection && (
        <>
          <BigField label={t("tripPortal.findings")} htmlFor="done-findings" required error={fieldError}>
            <Textarea id="done-findings" className={BIG_TEXTAREA} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </BigField>
          <BigField label={t("tripPortal.estimate")} htmlFor="done-estimate" help={t("tripPortal.estimateHelp")}>
            <Input
              id="done-estimate"
              inputMode={DECIMAL_INPUT}
              autoComplete="off"
              className={`${BIG_INPUT} tabular-nums`}
              placeholder="0.00"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </BigField>
        </>
      )}
      <BigField label={inspection ? t("tripPortal.anythingElse") : t("tripPortal.whatDidYouDo")} htmlFor="done-note">
        <Textarea id="done-note" className={BIG_TEXTAREA} value={note} onChange={(e) => setNote(e.target.value)} />
      </BigField>
      <PhotoField label={t("tripPortal.beforePhotos")} files={before} onChange={setBefore} />
      <PhotoField label={t("tripPortal.afterPhotos")} files={after} onChange={setAfter} />
      <FormError message={error} />
      <BigButton
        size="giant"
        icon={<Check aria-hidden="true" />}
        busy={busy}
        onClick={() => {
          if (inspection && !findings.trim()) {
            setFieldError(t("tripPortal.sayWhatFound"));
            document.getElementById("done-findings")?.focus();
            return;
          }
          setFieldError(null);
          void submit(
            (tok) =>
              tripPortalService.issueDone(tok, target.stop.id, target.issue.ticketIssueId, {
                note: note.trim() || null,
                findings: inspection ? findings.trim() : null,
                estimatedCost: inspection && estimate.trim() ? estimate.trim() : null,
                files: [...before, ...after],
              }),
            t("tripPortal.markedDone"),
          );
        }}
      >
        {t("tripPortal.done")}
      </BigButton>
    </>
  );
}

/* ── Couldn't do it (a job or the whole stop) ───────────────────────────── */

export function ReasonSheet({
  open,
  title,
  description,
  onClose,
  onSubmit,
  run,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (token: string, reason: string) => Promise<PublicTrip>;
  run: PortalRun;
}) {
  return (
    <PortalSheet open={open} onOpenChange={(o) => !o && onClose()} title={title} description={description}>
      <ReasonForm onSubmit={onSubmit} run={run} onDone={onClose} />
    </PortalSheet>
  );
}

function ReasonForm({
  onSubmit,
  run,
  onDone,
}: {
  onSubmit: (token: string, reason: string) => Promise<PublicTrip>;
  run: PortalRun;
  onDone: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { busy, error, submit } = useSheetSubmit(run, onDone);
  return (
    <>
      <BigField label={t("tripPortal.whyNot")} htmlFor="notdone-reason" required error={fieldError}>
        <Textarea id="notdone-reason" className={BIG_TEXTAREA} value={reason} onChange={(e) => setReason(e.target.value)} />
      </BigField>
      <FormError message={error} />
      <BigButton
        size="giant"
        variant="destructive"
        icon={<Send aria-hidden="true" />}
        busy={busy}
        onClick={() => {
          if (!reason.trim()) {
            setFieldError(t("tripPortal.sayWhy"));
            document.getElementById("notdone-reason")?.focus();
            return;
          }
          setFieldError(null);
          void submit((tok) => onSubmit(tok, reason.trim()), t("tripPortal.sent"));
        }}
      >
        {t("tripPortal.send")}
      </BigButton>
    </>
  );
}

/* ── Add a store ─────────────────────────────────────────────────────────── */

export function AddStoreSheet({
  open,
  onOpenChange,
  trip,
  run,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip: PublicTrip;
  run: PortalRun;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} title={t("tripPortal.addStore")} description={t("tripPortal.addStoreHelp")}>
      <AddStoreForm trip={trip} run={run} onDone={() => onOpenChange(false)} />
    </PortalSheet>
  );
}

function AddStoreForm({ trip, run, onDone }: { trip: PublicTrip; run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const { busy, error, submit } = useSheetSubmit(run, onDone);
  const onTrip = new Set(trip.stops.flatMap((s) => (s.store ? [s.store.id] : [])));
  const choices = (trip.stores ?? []).filter((s) => !onTrip.has(s.id));
  if (!choices.length) {
    return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-base text-muted-foreground">{t("tripPortal.noMoreStores")}</p>;
  }
  return (
    <>
      <div className="space-y-2">
        {choices.map((store) => (
          <BigButton
            key={store.id}
            type="button"
            variant="outline"
            disabled={busy}
            icon={<Store aria-hidden="true" />}
            className="justify-start"
            onClick={() => void submit((tok) => tripPortalService.addStop(tok, { storeId: store.id }), t("tripPortal.storeAdded"))}
          >
            {t("trips.storeN", { number: store.storeNumber })}
          </BigButton>
        ))}
      </div>
      <FormError message={error} />
    </>
  );
}

/* ── A note / photo ──────────────────────────────────────────────────────── */

export function NoteSheet({
  open,
  onOpenChange,
  trip,
  run,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip: PublicTrip;
  run: PortalRun;
}) {
  const t = useTranslations("maintenanceV2");
  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} title={t("tripPortal.addNote")} description={t("tripPortal.noteHelp")}>
      <NoteForm trip={trip} run={run} onDone={() => onOpenChange(false)} />
    </PortalSheet>
  );
}

function NoteForm({ trip, run, onDone }: { trip: PublicTrip; run: PortalRun; onDone: () => void }) {
  const t = useTranslations("maintenanceV2");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const here = trip.stops.find((s) => s.status === "arrived" && !s.leftAt) ?? null;
  const [stopId, setStopId] = useState<number | null>(here?.id ?? null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { busy, error, submit } = useSheetSubmit(run, onDone);
  const stops = trip.stops.filter((s) => !s.mistaken);
  return (
    <>
      <BigField label={t("common.note")} htmlFor="note-body" required error={fieldError}>
        <Textarea id="note-body" className={BIG_TEXTAREA} value={body} onChange={(e) => setBody(e.target.value)} />
      </BigField>
      <PhotoField label={t("common.photos")} files={files} onChange={setFiles} />
      {!!stops.length && (
        <BigField label={t("tripPortal.aboutWhichStore")}>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: null as number | null, name: t("tripPortal.wholeTrip") }, ...stops.map((s) => ({ id: s.id as number | null, name: s.store ? t("trips.storeN", { number: s.store.storeNumber }) : s.otherStore ?? "" }))].map(
              (o) => (
                <button
                  key={o.id ?? "trip"}
                  type="button"
                  aria-pressed={stopId === o.id}
                  onClick={() => setStopId(o.id)}
                  className={`min-h-12 rounded-xl border-2 px-3 text-base font-medium ${stopId === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                >
                  {o.name}
                </button>
              ),
            )}
          </div>
        </BigField>
      )}
      <FormError message={error} />
      <BigButton
        size="giant"
        icon={<Send aria-hidden="true" />}
        busy={busy}
        onClick={() => {
          if (!body.trim()) {
            setFieldError(t("tripPortal.writeSomething"));
            document.getElementById("note-body")?.focus();
            return;
          }
          setFieldError(null);
          void submit((tok) => tripPortalService.addNote(tok, { body: body.trim(), stopId, files }), t("tripPortal.noteSent"));
        }}
      >
        {t("tripPortal.send")}
      </BigButton>
    </>
  );
}
