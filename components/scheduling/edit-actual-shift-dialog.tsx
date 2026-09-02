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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { UserX, Clock, User } from "lucide-react";
import type { ScheduleEmployee, Shift, ActualShift } from "@/types/scheduling.types";
import { calcHours, formatTime } from "@/lib/scheduling/constants";

interface EditActualShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ScheduleEmployee | null;
  dayLabel: string;
  /** The planned shift being reviewed, if any (undefined = ad-hoc add-coverage) */
  plannedShift?: Shift | null;
  /** The existing actual entry being edited, if any */
  editingActual?: ActualShift | null;
  onSave: (startTime: string, endTime: string, label: string, type: Shift["type"], note: string) => void;
  onMarkAbsent: () => void;
}

export function EditActualShiftDialog({
  open,
  onOpenChange,
  employee,
  dayLabel,
  plannedShift,
  editingActual,
  onSave,
  onMarkAbsent,
}: EditActualShiftDialogProps) {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [label, setLabel] = useState("Morning");
  const [type, setType] = useState<Shift["type"]>("morning");
  const [note, setNote] = useState("");

  const isAddCoverage = !plannedShift;
  const isNewCoverage = isAddCoverage && !editingActual;

  useEffect(() => {
    if (editingActual && editingActual.status !== "absent") {
      setStartTime(editingActual.startTime);
      setEndTime(editingActual.endTime);
      setLabel(editingActual.label);
      setType(editingActual.type);
      setNote(editingActual.note ?? "");
    } else if (plannedShift) {
      setStartTime(plannedShift.startTime);
      setEndTime(plannedShift.endTime);
      setLabel(plannedShift.label);
      setType(plannedShift.type);
      setNote("");
    } else {
      setStartTime("08:00");
      setEndTime("16:00");
      setLabel("Morning");
      setType("morning");
      setNote("");
    }
  }, [editingActual, plannedShift, open]);

  const hours = useMemo(() => calcHours(startTime, endTime), [startTime, endTime]);

  const handleSubmit = () => {
    onSave(startTime, endTime, label, type, note.trim());
    onOpenChange(false);
  };

  const handleMarkAbsent = () => {
    onMarkAbsent();
    onOpenChange(false);
  };

  if (!employee) return null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNewCoverage ? "Add Coverage" : isAddCoverage ? "Edit Coverage" : "Edit Actual Time"}</DialogTitle>
          <DialogDescription>
            {isNewCoverage ? "Log" : "Update"} the actual time worked by{" "}
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
              <p className="text-sm font-semibold">{employee.name}</p>
              <p className="text-xs text-muted-foreground">{employee.role}</p>
            </div>
          </div>

          {/* Planned reference banner */}
          {plannedShift && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Planned: <span className="font-medium text-foreground">
                  {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)}
                </span>{" "}
                ({plannedShift.label})
              </p>
            </div>
          )}

          {/* Time selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="actual-start-time" className="text-xs">
                Start Time
              </Label>
              <Input
                id="actual-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="actual-end-time" className="text-xs">
                End Time
              </Label>
              <Input
                id="actual-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Shift label */}
          <div>
            <Label htmlFor="actual-shift-label" className="text-xs">
              Shift Label
            </Label>
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger id="actual-shift-label" className="mt-1">
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

          {/* Note */}
          <div>
            <Label htmlFor="actual-note" className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id="actual-note"
              placeholder="e.g. Clocked in late, covered for another employee..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 resize-none text-sm"
              maxLength={200}
            />
          </div>

          {/* Duration preview */}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-sm">
              <span className="font-medium">{formatTime(startTime)}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-medium">{formatTime(endTime)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{hours.toFixed(1)} hours</p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {!isAddCoverage ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={handleMarkAbsent}
            >
              <UserX className="h-4 w-4" />
              Mark No Attendance
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
