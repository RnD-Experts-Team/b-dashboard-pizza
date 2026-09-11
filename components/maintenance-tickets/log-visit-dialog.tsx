"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import {
  AttendanceFields,
  EMPTY_ATTENDANCE_FORM,
  buildAttendancePayload,
  type AttendanceFormValue,
} from "./attendance-panel";
import { IssuePickerDialog } from "./issue-picker-dialog";
import { FieldError } from "./form-bits";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Log a visit that does not sit under one ticket                           */
/*                                                                            */
/*  Renders the SAME AttendanceFields as the ticket-scoped panel, so the two  */
/*  forms cannot drift apart. Only the submit differs: this one posts to the  */
/*  global endpoint and requires the issues to be picked explicitly, since    */
/*  there is no ticket to seed them from.                                    */
/*                                                                            */
/*  OPEN QUESTION: CreateAttendanceEntryPayload types ticket_issue_ids as     */
/*  required, so at least one issue is required here. If the backend turns    */
/*  out to accept an empty array (a truly ticket-less visit), relaxing this   */
/*  is a one-line change.                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

interface LogVisitDialogProps {
  open: boolean;
  technicians: CatalogTechnician[];
  /** Scopes the ticket search. Null searches across every store. */
  storeNumber?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LogVisitDialog({
  open,
  technicians,
  storeNumber = null,
  onClose,
  onSuccess,
}: LogVisitDialogProps) {
  const [value, setValue] = useState<AttendanceFormValue>(EMPTY_ATTENDANCE_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [issueIds, setIssueIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function patch(next: Partial<AttendanceFormValue>) {
    setValue((prev) => ({ ...prev, ...next }));
    setFieldErrors((prev) => (Object.keys(prev).length ? {} : prev));
    setFormError(null);
  }

  function reset() {
    setValue(EMPTY_ATTENDANCE_FORM);
    setFiles([]);
    setIssueIds([]);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!value.technicianId) errors.technician_id = "Technician is required.";
    if (issueIds.length === 0) {
      errors.ticket_issue_ids = "Pick at least one issue this visit counts toward.";
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const { payload, topLevelFiles } = buildAttendancePayload(value, issueIds, files);
      await maintenanceTicketsService.createAttendanceEntryGlobal(payload, topLevelFiles);
      toast.success(
        `Visit logged for ${issueIds.length} issue${issueIds.length === 1 ? "" : "s"}`
      );
      reset();
      onSuccess?.();
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

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log a visit</DialogTitle>
            <DialogDescription>
              One attendance entry covering every issue worked, across any number of
              tickets.
            </DialogDescription>
          </DialogHeader>

          <AttendanceFields
            value={value}
            onChange={patch}
            technicians={technicians}
            files={files}
            onFilesChange={setFiles}
            fieldErrors={fieldErrors}
            disabled={isSubmitting}
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Issues worked <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={() => setPickerOpen(true)}
                disabled={isSubmitting}
              >
                Browse tickets…
              </Button>
              {issueIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {issueIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 text-[10px] font-normal">
                      #{id}
                      <button
                        type="button"
                        className="ms-0.5 rounded-sm opacity-60 hover:opacity-100"
                        onClick={() => setIssueIds(issueIds.filter((x) => x !== id))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">None selected yet.</p>
              )}
              <FieldError message={fieldErrors.ticket_issue_ids} />
            </div>
          </AttendanceFields>

          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              Save visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pickerOpen && (
        <IssuePickerDialog
          open
          storeNumber={storeNumber}
          selectedIssueIds={issueIds}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setIssueIds(ids);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
