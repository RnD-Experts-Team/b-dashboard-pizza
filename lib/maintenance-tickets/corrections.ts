/**
 * "Correct this" -- turning a wrong record into a right one without retyping it.
 *
 * The backend never edits and never deletes. A mistake is flagged `mistaken`
 * and a replacement is written beside it, and that is deliberate: it is how
 * nobody can quietly alter data and how everyone stays accountable. We are not
 * softening that. `mistaken` stays exactly as it is, and "just mark it
 * mistaken" stays available on its own.
 *
 * What this adds is the retyping. Correcting a clock-out that should have said
 * 17:15 meant flagging the entry and then re-entering the technician, the date,
 * four clock pairs and the note from scratch. These functions read an existing
 * record back into the draft the form already uses, so the coordinator changes
 * the one field that was wrong and saves.
 *
 * Pure: no React, no service calls. The caller does the flag-then-open.
 */

import type { IssueDraft } from "@/lib/hooks/use-ticket-draft";
import type {
  TicketIssueAttendance,
  TicketIssuePartUsage,
  TicketIssuePayEntry,
  TicketIssueWarranty,
  TicketIssueDiagnosis,
} from "@/types/maintenance-tickets.types";
import type { IssueActionId } from "./issue-actions";

/** What a correction needs: which form to open, and what to put in it. */
export interface CorrectionSeed {
  action: IssueActionId;
  patch: Partial<IssueDraft>;
}

/**
 * The forms hold local `YYYY-MM-DDTHH:mm` strings with no offset, which is what
 * DateTimePicker emits and what `toRfc3339OrUndefined` expects on the way back
 * out. The API sends timestamps with an offset, so trim rather than re-parse:
 * running it through `new Date()` would shift the displayed time by the
 * browser's offset and silently "correct" a time nobody asked to change.
 */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function numText(value: number | string | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function seedFromAttendance(entry: TicketIssueAttendance): CorrectionSeed {
  return {
    action: "attendance",
    patch: {
      attendanceTechnicianId: numText(entry.technicianId),
      attendanceStartClock: toLocalInput(entry.startClock),
      attendanceEndClock: toLocalInput(entry.endClock),
      attendanceStartBreak: toLocalInput(entry.startBreak),
      attendanceEndBreak: toLocalInput(entry.endBreak),
      attendanceStartPartsRun: toLocalInput(entry.startPartsRun),
      attendanceEndPartsRun: toLocalInput(entry.endPartsRun),
      attendanceStartTravel: toLocalInput(entry.startTravel),
      attendanceEndTravel: toLocalInput(entry.endTravel),
      // Deliberately not carried over. A note explains the entry that was
      // wrong; repeating it on the replacement would restate a mistake as fact.
      attendanceNoteBody: "",
    },
  };
}

export function seedFromPartUsage(usage: TicketIssuePartUsage): CorrectionSeed {
  return {
    action: "part",
    patch: {
      partId: numText(usage.partId),
      partQuantity: numText(usage.quantity),
      partUnitCost: numText(usage.unitCost),
      partSource: usage.source?.value ?? "",
      partPaidBy: usage.paidBy?.value ?? "",
      partPaidByTechnicianId: numText(usage.paidByTechnicianId),
      partStorageLocationId: numText(usage.storageLocationId),
      partReturnedQuantity: numText(usage.returnedQuantity),
      partReturnedToStorageLocationId: numText(usage.returnedToStorageLocationId),
      partVendorNote: "",
    },
  };
}

export function seedFromPayEntry(entry: TicketIssuePayEntry): CorrectionSeed {
  return {
    action: "pay",
    patch: {
      payTechnicianId: numText(entry.technicianId),
      basePay: numText(entry.basePay),
      performancePay: numText(entry.performancePay),
      drivingBasePay: numText(entry.drivingBasePay),
      drivingPerformancePay: numText(entry.drivingPerformancePay),
      drivingTime: numText(entry.drivingTime),
      milesDriven: numText(entry.milesDriven),
      perMileRate: numText(entry.perMileRate),
    },
  };
}

export function seedFromWarranty(warranty: TicketIssueWarranty): CorrectionSeed {
  return {
    action: "warranty",
    patch: {
      warrantyBody: warranty.body ?? "",
      warrantyExpiry: toDateInput(warranty.expiryDate),
    },
  };
}

export function seedFromDiagnosis(diagnosis: TicketIssueDiagnosis): CorrectionSeed {
  return {
    action: "diagnosis",
    patch: {
      diagnosisBody: diagnosis.body ?? "",
    },
  };
}

/** The kinds of record a correction can start from. */
export type CorrectableKind = "attendance" | "part" | "pay" | "warranty" | "diagnosis";

/** Plain-language names, for the confirm copy. Singular, lowercase, so they
 *  read inside a sentence: "Replace this set of hours?" */
export const CORRECTABLE_LABELS: Record<CorrectableKind, string> = {
  attendance: "set of hours",
  part: "part",
  pay: "payment",
  warranty: "warranty",
  diagnosis: "note",
};
