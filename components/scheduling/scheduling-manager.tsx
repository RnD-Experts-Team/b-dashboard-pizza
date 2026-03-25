"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Send, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeSidebar } from "./employee-sidebar";
import { ScheduleGrid } from "./schedule-grid";
import { AddShiftDialog } from "./add-shift-dialog";
import { PublishedSchedules } from "./published-schedules";
import { DUMMY_EMPLOYEES, DAYS_OF_WEEK, calcHours } from "@/lib/scheduling/data";
import type { Shift, PublishedSchedule, ScheduleEmployee } from "@/types/scheduling.types";

/**
 * Returns the week starting on Tuesday and ending on Monday.
 * offset = 0 means the current week.
 */
function getWeekDates(offset: number): {
  start: Date;
  end: Date;
  label: string;
  /** Day-of-month strings for the 7-day span (Tue → Mon) */
  dayDates: string[];
} {
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun … 6=Sat
  // Distance back to the most recent Tuesday (day 2)
  const distToTue = (jsDay + 5) % 7; // Tue=0, Wed=1 … Mon=6
  const start = new Date(now);
  start.setDate(now.getDate() - distToTue + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const dayDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dayDates.push(d.getDate().toString());
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    start,
    end,
    label: `${fmt(start)} - ${fmt(end)}, ${start.getFullYear()}`,
    dayDates,
  };
}

export function SchedulingManager() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [publishedSchedules, setPublishedSchedules] = useState<PublishedSchedule[]>([]);

  // Shift dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{
    employeeId: string;
    dayIndex: number;
  } | null>(null);
  /** When set, the dialog is in edit mode for this shift */
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const screenshotInnerRef = useRef<HTMLDivElement>(null);

  const week = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const pendingEmployee: ScheduleEmployee | null = editingShift
    ? DUMMY_EMPLOYEES.find((e) => e.id === editingShift.employeeId) ?? null
    : pendingDrop
      ? DUMMY_EMPLOYEES.find((e) => e.id === pendingDrop.employeeId) ?? null
      : null;

  const handleDropEmployee = useCallback(
    (employeeId: string, dayIndex: number) => {
      setPendingDrop({ employeeId, dayIndex });
      setShiftDialogOpen(true);
    },
    []
  );

  const handleConfirmShift = useCallback(
    (startTime: string, endTime: string, station: string) => {
      if (editingShift) {
        // Edit mode — update the existing shift in place
        setShifts((prev) =>
          prev.map((s) =>
            s.id === editingShift.id
              ? { ...s, startTime, endTime, station }
              : s
          )
        );
        setEditingShift(null);
        toast.success("Shift updated");
        return;
      }
      if (!pendingDrop) return;
      const newShift: Shift = {
        id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId: pendingDrop.employeeId,
        dayIndex: pendingDrop.dayIndex,
        startTime,
        endTime,
        station,
      };
      setShifts((prev) => [...prev, newShift]);
      setPendingDrop(null);
      toast.success("Shift added successfully");
    },
    [pendingDrop, editingShift]
  );

  const handleEditShift = useCallback((shift: Shift) => {
    setEditingShift(shift);
    setPendingDrop(null);
    setShiftDialogOpen(true);
  }, []);

  const handleRemoveShift = useCallback((shiftId: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    toast.info("Shift removed");
  }, []);

  const handlePublish = useCallback(async () => {
    if (shifts.length === 0) {
      toast.warning("No shifts to publish");
      return;
    }

    setIsPublishing(true);

    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas-pro")).default;
      const target = gridRef.current;
      if (!target) {
        toast.error("Could not capture schedule");
        return;
      }

      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 1.5,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");

      const published: PublishedSchedule = {
        id: `pub-${Date.now()}`,
        weekLabel: week.label,
        publishedAt: new Date().toISOString(),
        screenshotDataUrl: dataUrl,
        shifts: [...shifts],
      };

      setPublishedSchedules((prev) => [published, ...prev]);
      setShifts([]);
      toast.success("Schedule published successfully!");
    } catch {
      toast.error("Failed to capture schedule screenshot");
    } finally {
      setIsPublishing(false);
    }
  }, [shifts, week.label]);

  const handleScreenshot = useCallback(async () => {
    setIsTakingScreenshot(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const inner = screenshotInnerRef.current;
      if (!inner) return;

      // Temporarily expand the scroll wrapper so all content is visible
      const scrollWrapper = inner.parentElement as HTMLElement;
      const origHeight = scrollWrapper.style.height;
      const origOverflow = scrollWrapper.style.overflow;
      scrollWrapper.style.height = "auto";
      scrollWrapper.style.overflow = "visible";

      try {
        const canvas = await html2canvas(inner, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        const link = document.createElement("a");
        link.download = `schedule-${week.label.replace(/[^a-z0-9]/gi, "-")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Screenshot downloaded!");
      } finally {
        scrollWrapper.style.height = origHeight;
        scrollWrapper.style.overflow = origOverflow;
      }
    } catch {
      toast.error("Failed to take screenshot");
    } finally {
      setIsTakingScreenshot(false);
    }
  }, [week.label]);

  const handleRestore = useCallback((schedule: PublishedSchedule) => {
    setShifts(schedule.shifts.map((s) => ({ ...s })));
    toast.success("Schedule restored");
  }, []);

  const handleDeletePublished = useCallback((id: string) => {
    setPublishedSchedules((prev) => prev.filter((s) => s.id !== id));
    toast.info("Published schedule removed");
  }, []);

  // Summary stats
  const totalLaborHours = useMemo(
    () => shifts.reduce((acc, s) => acc + calcHours(s.startTime, s.endTime), 0),
    [shifts]
  );

  const totalLaborCost = totalLaborHours * 15; // ~$15/hr avg

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Schedule Manager"
        description="Drag employees onto days to create shifts"
      >
        <Button
          onClick={handlePublish}
          disabled={isPublishing || shifts.length === 0}
        >
          <Send className="mr-2 h-4 w-4" />
          {isPublishing ? "Publishing..." : "Publish"}
        </Button>
        <Button
          variant="outline"
          onClick={handleScreenshot}
          disabled={isTakingScreenshot}
        >
          <Camera className="mr-2 h-4 w-4" />
          {isTakingScreenshot ? "Capturing..." : "Screenshot"}
        </Button>
      </PageHeader>

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[220px] text-center text-sm font-medium">
          Week of: {week.label}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekOffset((o) => o + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content: sidebar + grid */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Employee sidebar */}
        <Card className="w-full lg:w-48 xl:w-52 shrink-0 gap-2 pt-5">
          <CardHeader className="pb-0 pt-0 px-3">
            <CardTitle className="text-[10px] font-medium">Employees</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-1">
            <EmployeeSidebar employees={DUMMY_EMPLOYEES} shifts={shifts} />
          </CardContent>
        </Card>

        {/* Schedule grid */}
        <div className="flex-1 min-w-0" ref={gridRef}>
          <ScheduleGrid
            employees={DUMMY_EMPLOYEES}
            shifts={shifts}
            weekDates={week.dayDates}
            innerRef={screenshotInnerRef}
            onDropEmployee={handleDropEmployee}
            onRemoveShift={handleRemoveShift}
            onEditShift={handleEditShift}
          />
        </div>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-8">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Labor Hours
              </p>
              <p className="text-xl font-bold">{totalLaborHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Est. Labor Cost
              </p>
              <p className="text-xl font-bold">
                ${totalLaborCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{shifts.length} shift(s) scheduled</span>
            {shifts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setShifts([]);
                  toast.info("Schedule cleared");
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shift dialog */}
      <AddShiftDialog
        open={shiftDialogOpen}
        onOpenChange={(open) => {
          setShiftDialogOpen(open);
          if (!open) {
            setPendingDrop(null);
            setEditingShift(null);
          }
        }}
        employee={pendingEmployee}
        dayLabel={
          editingShift
            ? DAYS_OF_WEEK[editingShift.dayIndex]
            : pendingDrop
              ? DAYS_OF_WEEK[pendingDrop.dayIndex]
              : ""
        }
        onConfirm={handleConfirmShift}
        editingShift={editingShift}
      />

      {/* Published schedules section */}
      <Separator />
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Published Schedules</h2>
        <PublishedSchedules
          schedules={publishedSchedules}
          onRestore={handleRestore}
          onDelete={handleDeletePublished}
        />
      </div>
    </div>
  );
}
