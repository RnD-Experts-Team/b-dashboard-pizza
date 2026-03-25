"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleEmployee, Shift } from "@/types/scheduling.types";
import { STATIONS, getTimeOptions, formatTime } from "@/lib/scheduling/data";

interface AddShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ScheduleEmployee | null;
  dayLabel: string;
  /** Called for both add and edit. */
  onConfirm: (startTime: string, endTime: string, station: string) => void;
  /** When set the dialog is in edit mode and pre-fills values. */
  editingShift?: Shift | null;
}

export function AddShiftDialog({
  open,
  onOpenChange,
  employee,
  dayLabel,
  onConfirm,
  editingShift,
}: AddShiftDialogProps) {
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [station, setStation] = useState(employee?.station ?? STATIONS[0]);

  const isEditing = !!editingShift;
  const timeOptions = getTimeOptions();

  // Sync form state when editing or when dialog opens with new employee
  useEffect(() => {
    if (editingShift) {
      setStartTime(editingShift.startTime);
      setEndTime(editingShift.endTime);
      setStation(editingShift.station);
    } else if (employee) {
      setStartTime("10:00");
      setEndTime("18:00");
      setStation(employee.station);
    }
  }, [editingShift, employee]);

  const handleSubmit = () => {
    onConfirm(startTime, endTime, station);
    onOpenChange(false);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update" : "Schedule"}{" "}
            <strong>{employee.name}</strong>&apos;s shift for{" "}
            <strong>{dayLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger id="start-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.slice(0, -1).map((t) => (
                  <SelectItem key={`start-${t}`} value={t}>
                    {formatTime(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="end-time">End Time</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger id="end-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((t) => (
                  <SelectItem key={`end-${t}`} value={t}>
                    {formatTime(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="station">Station</Label>
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger id="station">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Save Changes" : "Add Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
