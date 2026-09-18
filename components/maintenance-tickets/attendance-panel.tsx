"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceTimeline } from "./attendance-timeline";
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
  computeAttendancePreview,
  formatMinutes,
  parseAttendanceWarning,
  type AttendancePairInput,
} from "@/lib/maintenance-tickets/attendance-durations";
import { DateTimePicker, FieldError } from "./form-bits";
import { AttendanceStream } from "./attendance-stream";
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
/*  Clock rows                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface ClockRowDef {
  label: string;
  startKey: keyof AttendancePairInput;
  endKey: keyof AttendancePairInput;
  startLabel: string;
  endLabel: string;
}

/**
 * Four fixed rows. Any subset may be filled — that is the deliberate API
 * design, and the live preview flags a half-filled pair before the save
 * rather than blocking it.
 *
 * Travel gets "Travel start / Travel end" rather than Depart/Return, because
 * parts run already owns that pair and two "Depart" fields on one form is
 * unusable.
 */
const CLOCK_ROWS: ClockRowDef[] = [
  {
    label: "Work clock",
    startKey: "startClock",
    endKey: "endClock",
    startLabel: "Clock in",
    endLabel: "Clock out",
  },
  {
    label: "Travel",
    startKey: "startTravel",
    endKey: "endTravel",
    startLabel: "Travel start",
    endLabel: "Travel end",
  },
  {
    label: "Break",
    startKey: "startBreak",
    endKey: "endBreak",
    startLabel: "Break start",
    endLabel: "Break end",
  },
  {
    label: "Parts run",
    startKey: "startPartsRun",
    endKey: "endPartsRun",
    startLabel: "Depart",
    endLabel: "Return",
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared field block                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface AttendanceFieldsProps {
  /**
   * Offered as "Moving to another store". Omitted where there is nowhere to
   * hand off to (a single-store form), which is why it is optional rather than
   * a no-op default -- the button should not appear at all in that case.
   */
  onMoveToAnotherStore?: (closeCurrent: Partial<AttendanceFormValue>) => void;
  value: AttendanceFormValue;
  onChange: (patch: Partial<AttendanceFormValue>) => void;
  technicians: CatalogTechnician[];
  files: File[];
  onFilesChange: (files: File[]) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
  /** Slot for the issue picker, which differs between the two callers. */
  children?: React.ReactNode;
}

/**
 * The form itself, with no submit. Shared so the ticket-scoped panel and the
 * global "Log visit" dialog render identical UI and only their submit differs.
 */
export function AttendanceFields({
  value,
  onChange,
  technicians,
  files,
  onFilesChange,
  fieldErrors = {},
  disabled,
  children,
  onMoveToAnotherStore,
}: AttendanceFieldsProps) {
  const preview = useMemo(() => computeAttendancePreview(value), [value]);
  const technicianOptions = useMemo<SearchableSelectOption[]>(
    () =>
      technicians
        .filter((tech) => !tech.deletedAt)
        .map((tech) => ({
          value: String(tech.id),
          label: tech.name,
          hint: tech.categoryName ?? undefined,
        })),
    [technicians]
  );
  const hasAnyTime = ATTENDANCE_BUCKETS.some((b) => preview.minutes[b] > 0);
  const showPreview = hasAnyTime || preview.warnings.length > 0;

  return (
    <div className="space-y-3">
      {/* Technician */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Technician <span className="text-destructive">*</span>
        </Label>
        <SearchableSelect
          options={technicianOptions}
          value={value.technicianId || undefined}
          onChange={(v) => onChange({ technicianId: v })}
          disabled={disabled}
          placeholder="Select technician"
          searchPlaceholder="Search technicians…"
          emptyText="No technicians found."
          className={cn("h-8 text-sm", fieldErrors.technician_id && "border-destructive")}
        />
        <FieldError message={fieldErrors.technician_id} />
      </div>

      {children}

      {/*
        The visit itself, as a timeline rather than eight fields.

        This used to be four rows of paired pickers, all on screen from the
        start. That reads as data entry, and the person who designed the system
        said it confused everyone including him -- because the job is not
        filling a form, it is narrating a day while it happens: he clocked in,
        he drove, he arrived, he went for parts, he came back, he went on break.

        The fields are unchanged. Only the way in is.
      */}
      <AttendanceTimeline
        value={value}
        onChange={(patch) => onChange(patch as Partial<AttendanceFormValue>)}
        onMoveToAnotherStore={onMoveToAnotherStore}
        disabled={disabled}
      />

      {/* Errors for the clock fields still surface, keyed the same way the 422
          mapper writes them. */}
      {CLOCK_ROWS.map((row) => {
        const message = fieldErrors[row.startKey] ?? fieldErrors[row.endKey];
        return message ? <FieldError key={row.label} message={message} /> : null;
      })}

      {/* Live preview. The caption is load-bearing: it is what stops anyone
          treating this as authoritative. The read-only card always renders the
          server's own durations, never this. */}
      {showPreview && (
        <div className="space-y-2 rounded-md border border-dashed bg-muted/40 p-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preview — the server recalculates on save
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {ATTENDANCE_BUCKETS.map((bucket) => (
              <div key={bucket} className="min-w-0 space-y-0.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ATTENDANCE_BUCKET_LABELS[bucket]}
                </p>
                <p
                  className={cn(
                    "text-[11px] tabular-nums",
                    preview.minutes[bucket] > 0 ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {preview.minutes[bucket] > 0 ? formatMinutes(preview.minutes[bucket]) : "—"}
                </p>
                {bucket === "work" && (
                  <p className="text-[9px] leading-tight text-muted-foreground">
                    net of break, travel and parts run
                  </p>
                )}
              </div>
            ))}
          </div>
          {preview.warnings.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t pt-2">
              {preview.warnings.map((raw) => {
                const w = parseAttendanceWarning(raw);
                return (
                  <span
                    key={raw}
                    title={w.raw}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  >
                    {w.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Note, sent WITH the entry rather than as a follow-up */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Note</Label>
        <Textarea
          className="min-h-14 resize-none text-sm"
          placeholder="Where you drove, what you did…"
          value={value.noteBody}
          onChange={(e) => onChange({ noteBody: e.target.value })}
          disabled={disabled}
        />
        <FieldError message={fieldErrors["notes.0.body"]} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Attachments</Label>
        <PasteFileZone files={files} onChange={onFilesChange} />
      </div>
    </div>
  );
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

export function AttendancePanel({
  issue,
  storeId,
  ticketId,
  liveEntry = null,
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

  async function handleSubmit() {
    if (!value.technicianId) {
      setFieldErrors({ technician_id: "Technician is required." });
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      // ATTENDANCE ONLY. createPartUsage, assignIssues and createDiagnosis
      // still require every issue to belong to the ticket and must keep using
      // `issueIds ?? [issue.id]`.
      //
      // The Set is load-bearing: appendDeep emits one ticket_issue_ids[] per
      // element, so a duplicate id would go over the wire twice.
      const ticketIssueIds = Array.from(
        new Set([...baseIssueIds, ...sameTicketExtras, ...crossTicketExtras])
      );

      const { payload, topLevelFiles } = buildAttendancePayload(value, ticketIssueIds, files);
      await maintenanceTicketsService.createAttendanceEntry(
        storeId,
        ticketId,
        payload,
        topLevelFiles
      );

      onClearDraftFields(DRAFT_KEYS);
      setFiles([]);
      setSameTicketExtras([]);
      setCrossTicketExtras([]);

      // Name what was actually saved — the "Shared with" map on the read-only
      // card is built from THIS ticket's issues only and will under-report a
      // cross-ticket entry, so this toast is the honest record of it.
      const extras = ticketIssueIds.length - baseIssueIds.length;
      toast.success(
        extras > 0
          ? `Attendance saved for ${ticketIssueIds.length} issues`
          : "Attendance saved successfully"
      );
      onSuccess();
      onClose();
    } catch (err) {
      if (isCancelled(err)) return;
      if (err instanceof MaintenanceTicketsError) {
        const fields = getTicketsFieldErrors(err);
        if (Object.keys(fields).length) setFieldErrors(fields);
        setFormError(err.message);
      }
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * LIVE MODE. Adding to a session that already exists.
   *
   * There is no form and no save button, because there is nothing to save: each
   * press writes one event and the server hands back the whole session. That is
   * the whole point of the change -- the previous shape had no update path at
   * all, so adding "he set off at 08:30" to a saved clock-in meant flagging the
   * record wrong and typing it again.
   *
   * onSuccess() after every write, so the ticket's read-only copy of this
   * stream stays honest rather than drifting until something else reloads.
   */
  if (liveEntry) {
    const isPaid = liveEntry.payment?.status.value === "paid";

    const record = async (kind: AttendanceEventKind, at: string) => {
      try {
        const session = await maintenanceTicketsService.createAttendanceEvent(
          storeId,
          ticketId,
          liveEntry.id,
          { kind, at }
        );
        // A clock_in on an open session opens a NEW one upstream, so say which
        // it landed on rather than letting it look like nothing happened.
        toast.success(
          session.id === liveEntry.id
            ? "Recorded."
            : "Started a new session — the last one was already closed."
        );
        onSuccess();
      } catch (err) {
        if (isCancelled(err)) return;
        toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not record that.");
      }
    };

    const correct = async (event: AttendanceEvent, at: string) => {
      try {
        await maintenanceTicketsService.updateAttendanceEvent(
          storeId, ticketId, liveEntry.id, event.id, at
        );
        onSuccess();
      } catch (err) {
        if (isCancelled(err)) return;
        // The 422 for an already-paid session explains the alternative. Show
        // the server's sentence rather than replacing it with a generic one.
        toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not change that.");
      }
    };

    const strike = async (event: AttendanceEvent) => {
      try {
        await maintenanceTicketsService.markAttendanceEventMistaken(
          storeId, ticketId, liveEntry.id, event.id
        );
        toast.success(`${event.label} marked as a mistake. It stays on the record, struck through.`);
        onSuccess();
      } catch (err) {
        if (isCancelled(err)) return;
        toast.error(err instanceof MaintenanceTicketsError ? err.message : "Could not do that.");
      }
    };

    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {liveEntry.technician?.name ?? `Technician #${liveEntry.technicianId}`}
          </p>
          {isPaid && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              on a pay sheet — times are fixed
            </span>
          )}
        </div>

        <AttendanceStream
          events={liveEntry.events}
          isPaid={isPaid}
          onRecord={record}
          onCorrect={correct}
          onStrike={strike}
        />

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Add Attendance
      </p>

      <AttendanceFields
        value={value}
        onChange={patch}
        technicians={visibleTechnicians}
        files={files}
        onFilesChange={setFiles}
        fieldErrors={fieldErrors}
        disabled={isSubmitting}
      >
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
      </AttendanceFields>

      {fieldErrors.ticket_issue_ids && <FieldError message={fieldErrors.ticket_issue_ids} />}
      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !value.technicianId}>
          {isSubmitting && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
