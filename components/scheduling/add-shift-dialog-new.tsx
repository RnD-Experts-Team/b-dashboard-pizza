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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScheduleEmployee, Shift } from "@/types/scheduling.types";
import {
  SHIFT_PRESETS,
  formatTime,
  calcHours,
  EMPLOYEE_COLORS,
} from "@/lib/scheduling/data";

interface AddShiftDialogNewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ScheduleEmployee | null;
  dayLabel: string;
  onConfirm: (
    startTime: string,
    endTime: string,
    label: string,
    type: Shift["type"]
  ) => void;
  editingShift?: Shift | null;
}

export function AddShiftDialogNew({
  open,
  onOpenChange,
  employee,
  dayLabel,
  onConfirm,
  editingShift,
}: AddShiftDialogNewProps) {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [label, setLabel] = useState("Morning");
  const [type, setType] = useState<Shift["type"]>("morning");
  const [activePreset, setActivePreset] = useState<number | null>(0);

  const isEditing = !!editingShift;

  // Sync form when dialog opens
  useEffect(() => {
    if (editingShift) {
      setStartTime(editingShift.startTime);
      setEndTime(editingShift.endTime);
      setLabel(editingShift.label);
      setType(editingShift.type);
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
    }
  }, [editingShift, open]);

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
    onConfirm(startTime, endTime, label, type);
    onOpenChange(false);
  };

  if (!employee) return null;

  const palette = EMPLOYEE_COLORS[employee.color] ?? EMPLOYEE_COLORS.blue;
  const hours = calcHours(startTime, endTime);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              "flex items-center gap-2 rounded-md border px-3 py-2",
              palette.bg,
              palette.border
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                palette.text
              )}
            >
              {employee.avatar}
            </div>
            <div>
              <p className={cn("text-sm font-semibold", palette.text)}>
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
