"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertTriangle, Ban, StickyNote, User } from "lucide-react";
import type {
  ScheduleEmployee,
  Shift,
  AvailabilityRule,
  TimeOffEntry,
  EmployeeSyncRequestStatus,
} from "@/types/scheduling.types";
import { SHIFT_PRESETS, calcHours, formatTime } from "@/lib/scheduling/constants";
import { EmployeeSyncWaiting } from "./employee-sync-notice";
import { ScheduleErrorAlert } from "./schedule-error-alert";
import type { SchedulingError } from "@/lib/scheduling/errors";
import {
  wouldConflict,
  isBlockedByAvailability,
  hasTimeOff,
} from "@/lib/scheduling/utils";

interface AddShiftDialogNewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while the create/update request is in flight. */
  isSubmitting?: boolean;
  /**
   * Set when the API refused because the employee has no Humanity counterpart
   * yet. This is a WAIT, not a failure: the dialog stays open with the typed
   * values intact and the write replays automatically once setup completes.
   */
  syncWait?: {
    employeeName: string;
    status: EmployeeSyncRequestStatus;
    elapsedSeconds: number;
    timedOut: boolean;
    lastError: string | null;
  } | null;
  onCancelSyncWait?: () => void;
  onRequestManualSync?: () => void;
  onRetryAfterSync?: () => void;
  isRequestingSync?: boolean;
  /** A refusal the manager cannot override, shown inline with the server's wording. */
  error?: SchedulingError | null;
  employee: ScheduleEmployee | null;
  dayLabel: string;
  dayIndex: number;
  currentShifts: Shift[];
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  onConfirm: (
    startTime: string,
    endTime: string,
    label: string,
    type: Shift["type"],
    isRecurring: boolean,
    note: string
  ) => void;
  editingShift?: Shift | null;
  /**
   * Set when editing an UNSAVED shift. Carries only times/label/note —
   * a draft has no server-assigned fields, which is why it cannot just be
   * passed as `editingShift`.
   */
  editingDraft?: {
    startTime: string;
    endTime: string;
    label: string;
    type: Shift["type"];
    note?: string;
  } | null;
}

export function AddShiftDialogNew({
  open,
  onOpenChange,
  isSubmitting = false,
  syncWait = null,
  onCancelSyncWait,
  onRequestManualSync,
  onRetryAfterSync,
  isRequestingSync = false,
  error = null,
  employee,
  dayLabel,
  dayIndex,
  currentShifts,
  availability,
  timeOff: timeOffEntries,
  onConfirm,
  editingShift,
  editingDraft = null,
}: AddShiftDialogNewProps) {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [label, setLabel] = useState("Morning");
  const [type, setType] = useState<Shift["type"]>("morning");
  const [activePreset, setActivePreset] = useState<number | null>(0);
  // No UI control: the backend accepts is_recurring and silently ignores it, so
  // offering a toggle would promise scheduling that never happens. The state is
  // kept so editing an existing recurring shift preserves its flag rather than
  // stripping it. Restore the toggle once series generation ships.
  const [isRecurring, setIsRecurring] = useState(false);
  const [note, setNote] = useState("");

  const isEditing = !!editingShift || !!editingDraft;

  // Sync form when dialog opens
  useEffect(() => {
    if (editingDraft) {
      setStartTime(editingDraft.startTime);
      setEndTime(editingDraft.endTime);
      setLabel(editingDraft.label);
      setType(editingDraft.type);
      setNote(editingDraft.note ?? "");
      setIsRecurring(false);
      const draftPreset = SHIFT_PRESETS.findIndex(
        (pr) =>
          pr.startTime === editingDraft.startTime &&
          pr.endTime === editingDraft.endTime
      );
      setActivePreset(draftPreset >= 0 ? draftPreset : null);
    } else if (editingShift) {
      setStartTime(editingShift.startTime);
      setEndTime(editingShift.endTime);
      setLabel(editingShift.label);
      setType(editingShift.type);
      setIsRecurring(editingShift.isRecurring ?? false);
      setNote(editingShift.note ?? "");
      // Find matching preset
      const presetIdx = SHIFT_PRESETS.findIndex(
        (p) =>
          p.startTime === editingShift.startTime &&
          p.endTime === editingShift.endTime
      );
      setActivePreset(presetIdx >= 0 ? presetIdx : null);
    } else {
      setStartTime("08:00");
      setEndTime("16:00");
      setLabel("Morning");
      setType("morning");
      setActivePreset(0);
      setIsRecurring(false);
      setNote("");
    }
  }, [editingShift, editingDraft, open]);

  // Conflict warning
  const conflictWarning = useMemo(() => {
    if (!employee) return false;
    return wouldConflict(
      startTime,
      endTime,
      employee.id,
      dayIndex,
      currentShifts,
      editingShift?.id
    );
  }, [startTime, endTime, employee, dayIndex, currentShifts, editingShift]);

  // Availability warning
  const availabilityBlocked = useMemo(() => {
    if (!employee) return false;
    return isBlockedByAvailability(
      employee.id,
      dayIndex,
      startTime,
      endTime,
      availability
    );
  }, [employee, dayIndex, startTime, endTime, availability]);

  // Time-off warning
  const timeOffBlocked = useMemo(() => {
    if (!employee) return false;
    return hasTimeOff(employee.id, dayIndex, timeOffEntries);
  }, [employee, dayIndex, timeOffEntries]);

  const handlePresetClick = (idx: number) => {
    const preset = SHIFT_PRESETS[idx];
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setLabel(preset.label);
    setType(preset.type);
    setActivePreset(idx);
  };

  const handleTimeChange = () => {
    // When manually changing time, clear preset and set type to custom
    setActivePreset(null);
    if (type !== "custom") setType("custom");
    if (label === "Morning" || label === "Evening" || label === "Night" || label === "Split AM" || label === "Split PM") {
      setLabel("Custom");
    }
  };

  const handleSubmit = () => {
    // Deliberately does not close the dialog: the write may be refused or
    // suspended, and the manager's input must survive either. The parent closes
    // this once the write actually succeeds.
    onConfirm(startTime, endTime, label, type, isRecurring, note.trim());
  };

  if (!employee) return null;

  const hours = calcHours(startTime, endTime);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update" : "Schedule"} a shift for{" "}
            <strong>{employee.name}</strong> on <strong>{dayLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee preview */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground",
              )}
            >
              <User className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {employee.name}
              </p>
              <p className="text-xs text-muted-foreground">{employee.role}</p>
            </div>
          </div>

          {/* Preset quick-select */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Quick Presets
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SHIFT_PRESETS.map((preset, idx) => (
                <Badge
                  key={idx}
                  variant={activePreset === idx ? "default" : "outline"}
                  className="cursor-pointer text-xs px-2.5 py-1 transition-colors"
                  onClick={() => handlePresetClick(idx)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Time selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start-time" className="text-xs">
                Start Time
              </Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  handleTimeChange();
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end-time" className="text-xs">
                End Time
              </Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  handleTimeChange();
                }}
                className="mt-1"
              />
            </div>
          </div>

          {/* Shift label */}
          <div>
            <Label htmlFor="shift-label" className="text-xs">
              Shift Label
            </Label>
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger id="shift-label" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Evening">Evening</SelectItem>
                <SelectItem value="Night">Night</SelectItem>
                <SelectItem value="Split AM">Split AM</SelectItem>
                <SelectItem value="Split PM">Split PM</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shift note */}
          <div>
            <Label htmlFor="shift-note" className="text-xs flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              Note (optional)
            </Label>
            <Textarea
              id="shift-note"
              placeholder="e.g. Cover for Marco, Station 2 only..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 resize-none text-sm"
              maxLength={200}
            />
          </div>

          {/* Warnings */}
          {conflictWarning && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                This shift overlaps with an existing shift for {employee?.name}
              </p>
            </div>
          )}

          {availabilityBlocked && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <Ban className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {employee?.name} is marked unavailable during this time
              </p>
            </div>
          )}

          {timeOffBlocked && (
            <div className="flex items-center gap-2 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 px-3 py-2">
              <Ban className="h-4 w-4 text-purple-500 shrink-0" />
              <p className="text-xs text-purple-700 dark:text-purple-300">
                {employee?.name} has time off on this day
              </p>
            </div>
          )}

          {/* Duration preview */}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-sm">
              <span className="font-medium">{formatTime(startTime)}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-medium">{formatTime(endTime)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hours.toFixed(1)} hours
            </p>
          </div>
        </div>

        {/* Server refusal that is not overridable — shown with its own wording. */}
        {error && !syncWait && (
          <ScheduleErrorAlert
            error={error}
            title={isEditing ? "Couldn't save changes" : "Couldn't add this shift"}
            compact
          />
        )}

        {/* Resumable wait — the typed values above are preserved throughout. */}
        {syncWait && (
          <EmployeeSyncWaiting
            employeeName={syncWait.employeeName}
            status={syncWait.status}
            elapsedSeconds={syncWait.elapsedSeconds}
            timedOut={syncWait.timedOut}
            lastError={syncWait.lastError}
            onManualSync={() => onRequestManualSync?.()}
            onRetry={() => onRetryAfterSync?.()}
            onCancel={() => onCancelSyncWait?.()}
            isRequesting={isRequestingSync}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!syncWait && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : "Add Shift"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
