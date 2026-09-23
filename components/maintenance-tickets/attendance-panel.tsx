"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/shared/searchable-select";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_BUCKET_LABELS,
  formatMinutes,
  parseAttendanceWarning,
  type AttendancePairInput,
} from "@/lib/maintenance-tickets/attendance-durations";
import { FieldError } from "./form-bits";
import { AttendanceStream } from "./attendance-stream";
import { AttendanceDurationsStrip } from "./attendance-durations-strip";
import { PasteFileZone } from "./paste-file-zone";
import { IssuePickerDialog } from "./issue-picker-dialog";
import type { IssueDraft } from "@/lib/hooks/use-ticket-draft";
import type {
  AttendanceEvent,
  AttendanceEventKind,
  CatalogTechnician,
  CreateAttendanceEntryPayload,
  TicketIssue,
  TicketIssueAttendance,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Add Attendance                                                           */
/*                                                                            */
/*  Replaces a form that fired ONE POST PER FILLED CLOCK ROW. That is worth   */
/*  spelling out, because the old shape looked harmless:                     */
/*                                                                            */
/*   - Each row became its own record carrying exactly ONE clock field, which */
/*     is precisely what manufactures `incomplete_pair:<bucket>` on every     */
/*     record. The server's `durations` block is meaningless against data     */
/*     shaped like that.                                                     */
/*   - `Promise.all` had no partial-failure handling: 3 of 4 succeeding still */
/*     hit the catch, toasted a generic error, kept the draft, and left three */
/*     orphan records with no way to tell which had landed.                  */
/*                                                                            */
/*  One entry, one POST. A capability is deliberately lost: the old toggle UI */
/*  could record two clock-ins in one submit. Two clock-ins are two visits,   */
/*  so that is now two submits — and `start_clock`/`end_clock` are scalar     */
/*  fields, so the payload could never express it anyway.                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AttendanceFormValue extends AttendancePairInput {
  technicianId: string;
  noteBody: string;
}

export const EMPTY_ATTENDANCE_FORM: AttendanceFormValue = {
  technicianId: "",
  startClock: "",
  endClock: "",
  startTravel: "",
  endTravel: "",
  startBreak: "",
  endBreak: "",
  startPartsRun: "",
  endPartsRun: "",
  noteBody: "",
};

/** RFC3339, or undefined when the picker is empty / unparseable. */
function toRfc3339OrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payload                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BuiltAttendanceRequest {
  payload: CreateAttendanceEntryPayload;
  /** Files that belong at the top level rather than on a note. */
  topLevelFiles?: File[];
}

export function buildAttendancePayload(
  value: AttendanceFormValue,
  ticketIssueIds: number[],
  files: File[]
): BuiltAttendanceRequest {
  const payload: CreateAttendanceEntryPayload = {
    ticket_issue_ids: ticketIssueIds,
    technician_id: Number(value.technicianId),
    start_clock: toRfc3339OrUndefined(value.startClock),
    end_clock: toRfc3339OrUndefined(value.endClock),
    start_break: toRfc3339OrUndefined(value.startBreak),
    end_break: toRfc3339OrUndefined(value.endBreak),
    start_parts_run: toRfc3339OrUndefined(value.startPartsRun),
    end_parts_run: toRfc3339OrUndefined(value.endPartsRun),
    start_travel: toRfc3339OrUndefined(value.startTravel),
    end_travel: toRfc3339OrUndefined(value.endTravel),
  };

  const body = value.noteBody.trim();
  if (body) {
    payload.notes = [{ body, ...(files.length ? { files } : {}) }];
    return { payload };
  }
  // A note with an empty body is a 422, so files with no note go top-level.
  return { payload, topLevelFiles: files.length ? files : undefined };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cross-issue picker                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface CrossIssueSectionProps {
  /** Issues already covered — rendered locked so they cannot be un-picked. */
  baseIssueIds: number[];
  ticketIssues?: TicketIssue[];
  sameTicketExtras: number[];
  onSameTicketExtras: (ids: number[]) => void;
  crossTicketExtras: number[];
  onCrossTicketExtras: (ids: number[]) => void;
  storeNumber: string | null;
  disabled?: boolean;
}

function CrossIssueSection({
  baseIssueIds,
  ticketIssues,
  sameTicketExtras,
  onSameTicketExtras,
  crossTicketExtras,
  onCrossTicketExtras,
  storeNumber,
  disabled,
}: CrossIssueSectionProps) {
  const [open, setOpen] = useState(
    () => sameTicketExtras.length > 0 || crossTicketExtras.length > 0
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const others = (ticketIssues ?? []).filter((i) => !baseIssueIds.includes(i.id));
  const extraCount = sameTicketExtras.length + crossTicketExtras.length;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
          <span>
            Also count this visit toward…
            {extraCount > 0 && (
              <span className="ms-1.5 font-medium text-foreground">+{extraCount}</span>
            )}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {/* Other issues on THIS ticket */}
          {others.length > 0 ? (
            <div className="space-y-1 rounded-md border bg-muted/20 p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Other issues on this ticket
              </p>
              {others.map((other) => {
                const checked = sameTicketExtras.includes(other.id);
                return (
                  <label
                    key={other.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(v) =>
                        onSameTicketExtras(
                          v === true
                            ? [...sameTicketExtras, other.id]
                            : sameTicketExtras.filter((id) => id !== other.id)
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{other.id}
                      </span>{" "}
                      {other.issueTitle || other.otherTitle || "Untitled"}
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        · {other.status.label}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="px-1 text-[11px] text-muted-foreground">
              No other issues on this ticket.
            </p>
          )}

          {/* Issues on OTHER tickets */}
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => setPickerOpen(true)}
              disabled={disabled}
            >
              Browse other tickets…
            </Button>
            {crossTicketExtras.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {crossTicketExtras.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 text-[10px] font-normal">
                    #{id}
                    <button
                      type="button"
                      className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                      onClick={() =>
                        onCrossTicketExtras(crossTicketExtras.filter((x) => x !== id))
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {pickerOpen && (
        <IssuePickerDialog
          open
          storeNumber={storeNumber}
          // NO technicianId on purpose. Cross-ticket attendance exists for
          // "drove to one store, worked three tickets", so narrowing to one
          // technician's assignments defeats the exact relaxation this is for —
          // and the list is already bounded by the ticket in front of you.
          // LogVisitDialog DOES filter: it is unscoped and fetches globally.
          selectedIssueIds={crossTicketExtras}
          lockedIssueIds={baseIssueIds}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            // Locked ids live in baseIssueIds already; do not duplicate them.
            onCrossTicketExtras(ids.filter((id) => !baseIssueIds.includes(id)));
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Ticket-scoped panel                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AttendancePanelProps {
  issue: TicketIssue;
  storeId: string;
  ticketId: number;
  /**
   * An existing session to add to, rather than starting a new one.
   *
   * When present the panel is in LIVE mode: every press writes an event
   * immediately and there is no save step. When absent it is the create form,
   * which still posts the eight clock fields in one go -- the API still accepts
   * them and turns them into events, which is what let this migrate in halves.
   */
  liveEntry?: TicketIssueAttendance | null;
  /**
   * Other sessions on this issue that are still open.
   *
   * Shown as a pick above the "who" question when `liveEntry` is null because
   * more than one was open and the caller could not guess which one you meant
   * -- so this asks rather than starting a new session on top of them.
   */
  openEntries?: TicketIssueAttendance[];
  /** The FULL list — narrowing happens inside, so it can be widened again. */
  technicians: CatalogTechnician[];
  issueIds?: number[];
  /** Every issue on this ticket, for the cross-issue picker. */
  ticketIssues?: TicketIssue[];
  /** Scopes the other-tickets picker. Null searches unscoped. */
  storeNumber?: string | null;
  issueDraft: IssueDraft;
  onPatchDraft: (patch: Partial<IssueDraft>) => void;
  onClearDraftFields: (keys: Array<keyof IssueDraft>) => void;
  onClose: () => void;
  onSuccess: () => void;
}

const DRAFT_KEYS: Array<keyof IssueDraft> = [
  "attendanceTechnicianId",
  "attendanceStartClock",
  "attendanceEndClock",
  "attendanceStartBreak",
  "attendanceEndBreak",
  "attendanceStartPartsRun",
  "attendanceEndPartsRun",
  "attendanceStartTravel",
  "attendanceEndTravel",
  "attendanceNoteBody",
];

/** The draft is the source of truth so a half-typed entry survives a close. */
function draftToForm(draft: IssueDraft): AttendanceFormValue {
  return {
    technicianId: draft.attendanceTechnicianId,
    startClock: draft.attendanceStartClock,
    endClock: draft.attendanceEndClock,
    startTravel: draft.attendanceStartTravel,
    endTravel: draft.attendanceEndTravel,
    startBreak: draft.attendanceStartBreak,
    endBreak: draft.attendanceEndBreak,
    startPartsRun: draft.attendanceStartPartsRun,
    endPartsRun: draft.attendanceEndPartsRun,
    noteBody: draft.attendanceNoteBody,
  };
}

const FORM_TO_DRAFT: Record<keyof AttendanceFormValue, keyof IssueDraft> = {
  technicianId: "attendanceTechnicianId",
  startClock: "attendanceStartClock",
  endClock: "attendanceEndClock",
  startTravel: "attendanceStartTravel",
  endTravel: "attendanceEndTravel",
  startBreak: "attendanceStartBreak",
  endBreak: "attendanceEndBreak",
  startPartsRun: "attendanceStartPartsRun",
  endPartsRun: "attendanceEndPartsRun",
  noteBody: "attendanceNoteBody",
};

/**
 * Which create-payload field each first event fills.
 *
 * Creating a session and recording its first event are ONE request: the create
 * endpoint still accepts the eight clock fields and turns them into events, so
 * there is no window in which an empty session exists because a second call
 * failed.
 */
export const FIRST_EVENT_FIELD: Record<AttendanceEventKind, keyof AttendanceFormValue> = {
  clock_in: "startClock",
  clock_out: "endClock",
  travel_start: "startTravel",
  travel_end: "endTravel",
  break_start: "startBreak",
  break_end: "endBreak",
  parts_run_start: "startPartsRun",
  parts_run_end: "endPartsRun",
};

export function AttendancePanel({
  issue,
  storeId,
  ticketId,
  liveEntry = null,
  openEntries = [],
  technicians,
  issueIds,
  ticketIssues,
  storeNumber = null,
  issueDraft,
  onPatchDraft,
  onClearDraftFields,
  onClose,
  onSuccess,
}: AttendancePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * The session being recorded into, as the SERVER last described it.
   *
   * Every write returns the whole session, so this is the freshest account of
   * it -- fresher than waiting for the page to refetch. Null until the first
   * event creates one; reset when the panel is pointed somewhere else.
   */
  const [session, setSession] = useState<TicketIssueAttendance | null>(null);
  const active = session ?? liveEntry;

  /** Picks one of the offered open sessions to continue, instead of typing a
   *  fresh "who" and starting a session on top of it. No request -- the panel
   *  already has everything it needs, the same as when `liveEntry` arrives
   *  pre-selected. */
  function adopt(entry: TicketIssueAttendance) {
    setSession(entry);
  }

  useEffect(() => {
    setSession(null);
  }, [liveEntry?.id]);

  // Cross-ticket picks stay LOCAL, not in the draft: drafts are keyed by this
  // issue and cached for 7 days, and a stale pick at a long-closed ticket is
  // worse than re-picking.
  const [sameTicketExtras, setSameTicketExtras] = useState<number[]>([]);
  const [crossTicketExtras, setCrossTicketExtras] = useState<number[]>([]);

  const baseIssueIds = useMemo(() => issueIds ?? [issue.id], [issueIds, issue.id]);
  const value = draftToForm(issueDraft);

  // Narrowed to the issue's own technicians by default, but widened the moment
  // extra issues are picked — the right person may not be attached to THIS one.
  const hasExtras = sameTicketExtras.length > 0 || crossTicketExtras.length > 0;
  const attached = new Set((issue.technicians ?? []).map((t) => t.id));
  const visibleTechnicians = hasExtras
    ? technicians
    : technicians.filter((t) => attached.size === 0 || attached.has(t.id));

  function patch(next: Partial<AttendanceFormValue>) {
    // Every field this form owns is a string on both sides, but indexing
    // Partial<IssueDraft> with a computed key widens to the union of ALL its
    // value types — hence the local string map and the cast at the boundary.
    const draftPatch: Record<string, string> = {};
    for (const [key, v] of Object.entries(next)) {
      draftPatch[FORM_TO_DRAFT[key as keyof AttendanceFormValue]] = v as string;
    }
    onPatchDraft(draftPatch as Partial<IssueDraft>);
    setFieldErrors((prev) => (Object.keys(prev).length ? {} : prev));
    setFormError(null);
  }

  /**
   * Record one thing that happened.
   *
   * Before the session exists this CREATES it, mapping the event onto the
   * create payload's matching clock field; afterwards it appends. Either way it
   * is one press and one request, and the server hands back the whole session.
   *
   * THE POINT OF ALL OF THIS: a clock-in used to be a form you filled in and
   * saved, after which the only thing the API would allow was marking it wrong.
   * Adding "he set off at 08:30" meant flagging the record and retyping it.
   */
  async function record(kind: AttendanceEventKind, at: string) {
    if (!value.technicianId && !active) {
      setFieldErrors({ technician_id: "Say who this is for first." });
      return;
    }

    setFormError(null);
    setFieldErrors({});

    try {
      if (!active) {
        // The Set is load-bearing: appendDeep emits one ticket_issue_ids[] per
        // element, so a duplicate id would go over the wire twice.
        const ticketIssueIds = Array.from(
          new Set([...baseIssueIds, ...sameTicketExtras, ...crossTicketExtras])
        );

        const seeded: AttendanceFormValue = { ...value, [FIRST_EVENT_FIELD[kind]]: at };
        const { payload, topLevelFiles } = buildAttendancePayload(seeded, ticketIssueIds, files);
        const created = await maintenanceTicketsService.createAttendanceEntry(
          storeId,
          ticketId,
          payload,
          topLevelFiles
        );

        setSession(created);
        onClearDraftFields(DRAFT_KEYS);
        setFiles([]);

        const extras = ticketIssueIds.length - baseIssueIds.length;
        toast.success(
          extras > 0
            ? `Started, counting toward ${ticketIssueIds.length} issues.`
            : "Started."
        );
        onSuccess();
        return;
      }

      const next = await maintenanceTicketsService.createAttendanceEvent(
        storeId,
        ticketId,
        active.id,
        { kind, at }
      );
      setSession(next);

      // A clock_in on a closed session opens a NEW one upstream, so say which
      // it landed on rather than letting it look like nothing happened.
      if (next.id !== active.id) {
        toast.success("Started a new session — the last one was already closed.");
      }
      onSuccess();
    } catch (err) {
      if (isCancelled(err)) return;
      if (err instanceof MaintenanceTicketsError) {
        const fields = getTicketsFieldErrors(err);
        if (Object.keys(fields).length) setFieldErrors(fields);
        setFormError(err.message);
      }
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not record that.");
    }
  }

  async function correct(event: AttendanceEvent, at: string) {
    if (!active) return;
    try {
      setSession(
        await maintenanceTicketsService.updateAttendanceEvent(
          storeId, ticketId, active.id, event.id, at
        )
      );
      onSuccess();
    } catch (err) {
      if (isCancelled(err)) return;
      // The 422 for an already-paid session explains the alternative. Show the
      // server's sentence rather than replacing it with a generic one.
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not change that.");
    }
  }

  async function strike(event: AttendanceEvent) {
    if (!active) return;
    try {
      setSession(
        await maintenanceTicketsService.markAttendanceEventMistaken(
          storeId, ticketId, active.id, event.id
        )
      );
      toast.success(`${event.label} marked as a mistake. It stays on the record, struck through.`);
      onSuccess();
    } catch (err) {
      if (isCancelled(err)) return;
      toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not do that.");
    }
  }

  const isPaid = active?.payment?.status.value === "paid";

  /*
   * ONE SURFACE, whether the session exists yet or not.
   *
   * It used to be two: an eight-field form behind "Log hours", and the event
   * stream only once something had been saved. Which meant the entire change
   * was invisible from the one button anybody actually presses.
   *
   * Who it is for is asked ONCE, before anything is recorded, and then stops
   * being a question -- a session belongs to one technician, so leaving the
   * picker there afterwards would be offering a choice that does nothing.
   */
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {active ? (active.technician?.name ?? `Technician #${active.technicianId}`) : "Log hours"}
        </p>
        {isPaid && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            on a pay sheet — times are fixed
          </span>
        )}
      </div>

      {!active && openEntries.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {openEntries.length === 1
              ? "Already on the clock for this issue"
              : `${openEntries.length} people already on the clock for this issue`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {openEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => adopt(entry)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
              >
                <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                Continue {entry.technician?.name ?? `Technician #${entry.technicianId}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {!active && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Who <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              options={visibleTechnicians.map((t) => ({
                value: String(t.id),
                label: t.name,
                hint: t.categoryName ?? undefined,
              }))}
              value={value.technicianId || undefined}
              onChange={(v) => patch({ technicianId: v })}
              placeholder="Select technician"
              searchPlaceholder="Search technicians…"
              emptyText="No technicians found."
              className="h-9 text-sm"
            />
            {fieldErrors.technician_id && <FieldError message={fieldErrors.technician_id} />}
          </div>

          <CrossIssueSection
            baseIssueIds={baseIssueIds}
            ticketIssues={ticketIssues}
            sameTicketExtras={sameTicketExtras}
            onSameTicketExtras={setSameTicketExtras}
            crossTicketExtras={crossTicketExtras}
            onCrossTicketExtras={setCrossTicketExtras}
            storeNumber={storeNumber}
            disabled={isSubmitting}
          />
        </div>
      )}

      <AttendanceStream
        events={active?.events ?? []}
        isPaid={isPaid}
        onRecord={record}
        onCorrect={correct}
        onStrike={strike}
      />

      {/* The server's own net figures, once there is something to total. The
          read-only card always renders THESE, never a client-side preview. */}
      {active && <AttendanceDurationsStrip durations={active.durations} />}

      {fieldErrors.ticket_issue_ids && <FieldError message={fieldErrors.ticket_issue_ids} />}
      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {active ? "Done" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
