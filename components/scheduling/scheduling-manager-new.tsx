"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Filter,
  Users,
  Clock,
  TrendingUp,
  ChevronDown,
  FileSpreadsheet,
  Camera,
  Loader2,
  Copy,
  Trash2,
  EyeOff,
  UserX,
  BookmarkPlus,
  FolderOpen,
  AlertTriangle,
  CalendarDays,
  LayoutGrid,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleGrid } from "./schedule-grid-new";
import { AddShiftDialogNew } from "./add-shift-dialog-new";
import { DayView } from "./day-view";
import { MonthOverview } from "./month-overview";
import {
  DUMMY_EMPLOYEES,
  DAYS_OF_WEEK,
  DAYS_SHORT,
  DEPARTMENTS,
  INITIAL_SHIFTS,
  PREVIOUS_WEEK_SHIFTS,
  INITIAL_AVAILABILITY,
  INITIAL_TIME_OFF,
  DEFAULT_OVERTIME_THRESHOLD,
  calcHours,
  formatTime,
} from "@/lib/scheduling/data";
import {
  detectConflicts,
  conflictedShiftIds,
  overtimeEmployees,
} from "@/lib/scheduling/utils";
import type {
  Shift,
  WeekInfo,
  ScheduleTemplate,
  ScheduleViewMode,
  AvailabilityRule,
  TimeOffEntry,
} from "@/types/scheduling.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Returns the week range starting on Tuesday and ending on Monday.
 * offset = 0 → the current week.
 */
function getWeekDates(offset: number): WeekInfo {
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun … 6=Sat
  const distToTue = (jsDay + 5) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - distToTue + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const dayDates: string[] = [];
  const fullDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dayDates.push(d.getDate().toString());
    fullDates.push(new Date(d));
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    start,
    end,
    label: `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`,
    dayDates,
    fullDates,
  };
}

export function SchedulingManager() {
  const [weekOffset, setWeekOffset] = useState(0);

  /**
   * Per-week shift storage keyed by weekOffset.
   * -1 = previous week, 0 = current week, 1 = next week, etc.
   */
  const [allShifts, setAllShifts] = useState<Record<number, Shift[]>>({
    0: INITIAL_SHIFTS,
    [-1]: PREVIOUS_WEEK_SHIFTS,
  });

  /** Convenience: shifts visible in the currently displayed week */
  const shifts = allShifts[weekOffset] ?? [];

  /** Mutate only the current week's slice */
  const setCurrentShifts = useCallback(
    (updater: (prev: Shift[]) => Shift[]) =>
      setAllShifts((all) => ({
        ...all,
        [weekOffset]: updater(all[weekOffset] ?? []),
      })),
    [weekOffset]
  );

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Availability & time-off
  const [availability] = useState<AvailabilityRule[]>(INITIAL_AVAILABILITY);
  const [timeOff] = useState<TimeOffEntry[]>(INITIAL_TIME_OFF);
  const [overtimeThreshold] = useState(DEFAULT_OVERTIME_THRESHOLD);

  const gridRef = useRef<HTMLDivElement>(null);

  // Shift dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    employeeId: string;
    dayIndex: number;
  } | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const week = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Filter employees by search + department
  const filteredEmployees = useMemo(() => {
    return DUMMY_EMPLOYEES.filter((emp) => {
      const matchSearch =
        !search ||
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.role.toLowerCase().includes(search.toLowerCase());
      const matchDept = department === "All" || emp.department === department;
      return matchSearch && matchDept;
    });
  }, [search, department]);

  // Summary stats
  const stats = useMemo(() => {
    const totalHours = shifts.reduce(
      (acc, s) => acc + calcHours(s.startTime, s.endTime),
      0
    );
    const uniqueEmployees = new Set(shifts.map((s) => s.employeeId)).size;
    const laborCost = totalHours * 15;
    return {
      totalHours,
      totalShifts: shifts.length,
      activeEmployees: uniqueEmployees,
      laborCost,
    };
  }, [shifts]);

  // Conflict detection
  const conflicts = useMemo(() => detectConflicts(shifts), [shifts]);
  const conflictIds = useMemo(() => conflictedShiftIds(conflicts), [conflicts]);
  const overtimeEmpIds = useMemo(
    () => overtimeEmployees(shifts, overtimeThreshold),
    [shifts, overtimeThreshold]
  );

  // Dialog target employee
  const targetEmployee = useMemo(() => {
    const id = editingShift?.employeeId ?? pendingAdd?.employeeId;
    return id ? DUMMY_EMPLOYEES.find((e) => e.id === id) ?? null : null;
  }, [editingShift, pendingAdd]);

  // --- Handlers ---

  const handleAddShift = useCallback(
    (employeeId: string, dayIndex: number) => {
      setPendingAdd({ employeeId, dayIndex });
      setEditingShift(null);
      setShiftDialogOpen(true);
    },
    []
  );

  const handleEditShift = useCallback((shift: Shift) => {
    setEditingShift(shift);
    setPendingAdd(null);
    setShiftDialogOpen(true);
  }, []);

  const handleDeleteShift = useCallback((shiftId: string) => {
    setCurrentShifts((prev) => prev.filter((s) => s.id !== shiftId));
    toast.info("Shift removed");
  }, [setCurrentShifts]);

  const handleConfirmShift = useCallback(
    (startTime: string, endTime: string, label: string, type: Shift["type"], isRecurring: boolean) => {
      if (editingShift) {
        setCurrentShifts((prev) =>
          prev.map((s) =>
            s.id === editingShift.id
              ? { ...s, startTime, endTime, label, type, isRecurring, recurringGroupId: isRecurring ? (s.recurringGroupId ?? s.id) : undefined }
              : s
          )
        );
        setEditingShift(null);
        toast.success("Shift updated");
        return;
      }
      if (!pendingAdd) return;
      const shiftId = `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newShift: Shift = {
        id: shiftId,
        employeeId: pendingAdd.employeeId,
        dayIndex: pendingAdd.dayIndex,
        startTime,
        endTime,
        label,
        type,
        isRecurring,
        recurringGroupId: isRecurring ? shiftId : undefined,
      };
      setCurrentShifts((prev) => [...prev, newShift]);
      setPendingAdd(null);
      toast.success("Shift added");
    },
    [pendingAdd, editingShift, setCurrentShifts]
  );

  const handleGoToToday = useCallback(() => {
    setWeekOffset(0);
  }, []);

  /**
   * Copy previous week's shifts into the current week.
   * Each shift gets a fresh ID to avoid duplicates.
   * dayIndex is preserved (0=Tue … 6=Mon) — it maps 1:1 between weeks.
   */
  const handleConfirmCopyPreviousWeek = useCallback(() => {
    const prevShifts = allShifts[weekOffset - 1] ?? [];
    if (prevShifts.length === 0) {
      toast.warning("No shifts found in the previous week");
      return;
    }
    const copied: Shift[] = prevShifts.map((s) => ({
      ...s,
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    setAllShifts((all) => ({ ...all, [weekOffset]: copied }));
    toast.success(
      `Copied ${copied.length} shift${copied.length !== 1 ? "s" : ""} from the previous week`
    );
  }, [allShifts, weekOffset]);

  /** Derived: does the previous week have any shifts? Used to disable the menu item. */
  const hasPreviousWeekShifts = (allShifts[weekOffset - 1] ?? []).length > 0;

  /** Save the current week's shifts as a reusable template */
  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      toast.warning("Please enter a template name");
      return;
    }
    if (shifts.length === 0) {
      toast.warning("No shifts to save as a template");
      return;
    }
    const totalHours = shifts.reduce(
      (acc, s) => acc + calcHours(s.startTime, s.endTime),
      0
    );
    const template: ScheduleTemplate = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      createdAt: new Date().toISOString(),
      shifts: shifts.map(({ id: _id, ...rest }) => rest),
      shiftCount: shifts.length,
      totalHours,
    };
    setTemplates((prev) => [template, ...prev]);
    setSaveTemplateOpen(false);
    setTemplateName("");
    setTemplateDescription("");
    toast.success(`Template "${template.name}" saved`);
  }, [templateName, templateDescription, shifts]);

  /** Load a template's shifts into the current week */
  const handleLoadTemplate = useCallback(
    (template: ScheduleTemplate) => {
      const loaded: Shift[] = template.shifts.map((s) => ({
        ...s,
        id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
      setAllShifts((all) => ({ ...all, [weekOffset]: loaded }));
      setLoadTemplateOpen(false);
      toast.success(
        `Loaded template "${template.name}" — ${loaded.length} shift${loaded.length !== 1 ? "s" : ""}`
      );
    },
    [weekOffset]
  );

  /** Delete a saved template */
  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    toast.info("Template deleted");
  }, []);

  /** Export the schedule as a CSV file that Excel opens natively */
  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      // Header row
      const headers = [
        "Employee",
        "Role",
        "Department",
        ...DAYS_SHORT.map((d, i) => `${d} ${week.dayDates[i] ?? ""}`),
        "Total Hours",
        "Total Shifts",
      ];

      const rows: string[][] = [headers];

      for (const emp of DUMMY_EMPLOYEES) {
        let totalHours = 0;
        let totalShifts = 0;
        const dayCells = DAYS_SHORT.map((_, dayIdx) => {
          const dayShifts = shifts.filter(
            (s) => s.employeeId === emp.id && s.dayIndex === dayIdx
          );
          if (dayShifts.length === 0) return "—";
          totalShifts += dayShifts.length;
          return dayShifts
            .map((s) => {
              const h = calcHours(s.startTime, s.endTime);
              totalHours += h;
              return `${formatTime(s.startTime)}-${formatTime(s.endTime)} (${s.label})`;
            })
            .join(" / ");
        });

        rows.push([
          emp.name,
          emp.role,
          emp.department,
          ...dayCells,
          `${totalHours.toFixed(1)}h`,
          String(totalShifts),
        ]);
      }

      // Add summary footer row
      rows.push([]);
      const dayTotalRow = [
        "Daily Totals",
        "",
        "",
        ...DAYS_SHORT.map((_, dayIdx) => {
          const h = shifts
            .filter((s) => s.dayIndex === dayIdx)
            .reduce((acc, s) => acc + calcHours(s.startTime, s.endTime), 0);
          return h > 0 ? `${h.toFixed(1)}h` : "—";
        }),
        `${shifts.reduce((acc, s) => acc + calcHours(s.startTime, s.endTime), 0).toFixed(1)}h`,
        String(shifts.length),
      ];
      rows.push(dayTotalRow);

      // Build CSV string with UTF-8 BOM so Excel recognises the encoding
      const csv =
        "\uFEFF" +
        rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\r\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${week.label.replace(/[^a-z0-9]/gi, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Schedule exported as Excel CSV");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [shifts, week]);

  /** Capture the schedule grid as a PNG screenshot */
  const handleScreenshot = useCallback(async () => {
    setIsTakingScreenshot(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const target = gridRef.current;
      if (!target) { toast.error("Could not find grid"); return; }

      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const a = document.createElement("a");
      a.download = `schedule-${week.label.replace(/[^a-z0-9]/gi, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("Screenshot downloaded");
    } catch {
      toast.error("Screenshot failed");
    } finally {
      setIsTakingScreenshot(false);
    }
  }, [week.label]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Page header */}
        <PageHeader
          title="Employee Schedule"
          description="Manage weekly shifts for your team"
        />

        {/* Toolbar: week nav + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium whitespace-nowrap">
                {week.label}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleGoToToday}
              >
                Today
              </Button>
            )}

            {/* View mode toggle */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 ml-2">
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() => setViewMode("week")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Week
              </Button>
              <Button
                variant={viewMode === "day" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() => setViewMode("day")}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Day
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() => setViewMode("month")}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Month
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Day selector (visible in day view) */}
            {viewMode === "day" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {DAYS_SHORT[selectedDayIndex]} {week.dayDates[selectedDayIndex]}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {DAYS_SHORT.map((day, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onSelect={() => setSelectedDayIndex(idx)}
                      className="gap-2 cursor-pointer"
                    >
                      {idx === selectedDayIndex && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      <span className={idx === selectedDayIndex ? "font-medium" : "pl-3.5"}>{day} {week.dayDates[idx]}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-45 pl-8 text-sm"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  {department}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {DEPARTMENTS.map((dept) => (
                  <DropdownMenuItem
                    key={dept}
                    onSelect={() => setDepartment(dept)}
                    className="gap-2 cursor-pointer"
                  >
                    {dept === department && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    <span className={dept === department ? "font-medium" : "pl-3.5"}>{dept}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
                  Actions
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Schedule</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!hasPreviousWeekShifts}
                  onSelect={() => setCopyConfirmOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-blue-600" />
                  Copy Previous Week
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 cursor-not-allowed opacity-60">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Clear Week
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 cursor-not-allowed opacity-60">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  Unpublish Week
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 cursor-not-allowed opacity-60">
                  <UserX className="h-4 w-4 text-amber-500" />
                  Unassign Week
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={shifts.length === 0}
                  onSelect={() => setSaveTemplateOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <BookmarkPlus className="h-4 w-4 text-violet-500" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={templates.length === 0}
                  onSelect={() => setLoadTemplateOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4 text-indigo-500" />
                  Load Week Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isExporting}
                  onSelect={handleExportExcel}
                  className="gap-2 cursor-pointer"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  )}
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Capture</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isTakingScreenshot}
                  onSelect={handleScreenshot}
                  className="gap-2 cursor-pointer"
                >
                  {isTakingScreenshot ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-violet-600" />
                  )}
                  Screenshot
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Total Hours
                </p>
                <p className="text-lg font-bold leading-tight">
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Shifts
                </p>
                <p className="text-lg font-bold leading-tight">
                  {stats.totalShifts}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Active Staff
                </p>
                <p className="text-lg font-bold leading-tight">
                  {stats.activeEmployees}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">$</span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Est. Labor
                </p>
                <p className="text-lg font-bold leading-tight">
                  ${stats.laborCost.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conflict & overtime warnings */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>{conflicts.length}</strong> shift conflict{conflicts.length !== 1 ? "s" : ""} detected this week — overlapping shifts for the same employee.
            </p>
          </div>
        )}

        {overtimeEmpIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{overtimeEmpIds.size}</strong> employee{overtimeEmpIds.size !== 1 ? "s" : ""} exceed{overtimeEmpIds.size === 1 ? "s" : ""} the {overtimeThreshold}h overtime threshold.
            </p>
          </div>
        )}

        {/* Active filters badge */}
        {(search || department !== "All") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Showing:</span>
            {department !== "All" && (
              <Badge variant="secondary" className="text-xs">
                {department}
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="text-xs">
                &quot;{search}&quot;
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              ({filteredEmployees.length} employee
              {filteredEmployees.length !== 1 ? "s" : ""})
            </span>
          </div>
        )}

        {/* The schedule view — switches between week / day / month */}
        <div ref={gridRef}>
          {viewMode === "week" && (
            <ScheduleGrid
              employees={filteredEmployees}
              shifts={shifts}
              week={week}
              conflictIds={conflictIds}
              overtimeEmpIds={overtimeEmpIds}
              overtimeThreshold={overtimeThreshold}
              availability={availability}
              timeOff={timeOff}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              onDeleteShift={handleDeleteShift}
            />
          )}

          {viewMode === "day" && (
            <DayView
              employees={filteredEmployees}
              shifts={shifts}
              dayIndex={selectedDayIndex}
              week={week}
              conflictIds={conflictIds}
              overtimeEmpIds={overtimeEmpIds}
              availability={availability}
              timeOff={timeOff}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              onDeleteShift={handleDeleteShift}
            />
          )}

          {viewMode === "month" && (
            <MonthOverview
              weekOffset={weekOffset}
              allShifts={allShifts}
              getWeekDates={getWeekDates}
              onNavigateToWeek={(offset) => {
                setWeekOffset(offset);
                setViewMode("week");
              }}
              onNavigateToDay={(offset, dayIdx) => {
                setWeekOffset(offset);
                setSelectedDayIndex(dayIdx);
                setViewMode("day");
              }}
            />
          )}
        </div>

        {/* Quick actions footer */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {shifts.length} shift{shifts.length !== 1 ? "s" : ""} scheduled this
            week
          </p>
          {shifts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive text-xs"
              onClick={() => {
                setCurrentShifts(() => []);
                toast.info("All shifts cleared");
              }}
            >
              Clear All Shifts
            </Button>
          )}
        </div>

        {/* Add/Edit shift dialog */}
        <AddShiftDialogNew
          open={shiftDialogOpen}
          onOpenChange={(open) => {
            setShiftDialogOpen(open);
            if (!open) {
              setPendingAdd(null);
              setEditingShift(null);
            }
          }}
          employee={targetEmployee}
          dayLabel={
            editingShift
              ? DAYS_OF_WEEK[editingShift.dayIndex]
              : pendingAdd
                ? DAYS_OF_WEEK[pendingAdd.dayIndex]
                : ""
          }
          dayIndex={editingShift?.dayIndex ?? pendingAdd?.dayIndex ?? 0}
          currentShifts={shifts}
          availability={availability}
          timeOff={timeOff}
          onConfirm={handleConfirmShift}
          editingShift={editingShift}
        />

        {/* Copy Previous Week — confirmation dialog */}
        <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Copy previous week’s schedule?</AlertDialogTitle>
              <AlertDialogDescription>
                This will <strong>replace</strong> all shifts currently scheduled
                for <strong>{week.label}</strong> with the shifts from the
                previous week.
                {shifts.length > 0 && (
                  <span className="block mt-1 text-destructive">
                    {shifts.length} existing shift{shifts.length !== 1 ? "s" : ""} will be overwritten.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmCopyPreviousWeek}
              >
                Yes, copy schedule
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Save as Template dialog */}
        <Dialog
          open={saveTemplateOpen}
          onOpenChange={(open) => {
            setSaveTemplateOpen(open);
            if (!open) {
              setTemplateName("");
              setTemplateDescription("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save as Template</DialogTitle>
              <DialogDescription>
                Save the current week&apos;s {shifts.length} shift{shifts.length !== 1 ? "s" : ""} as a reusable template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g. Standard Week, Holiday Coverage..."
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTemplate();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-desc">Description (optional)</Label>
                <Textarea
                  id="template-desc"
                  placeholder="Add any notes about this schedule template..."
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                <BookmarkPlus className="h-4 w-4 mr-1.5" />
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load Week Template dialog */}
        <Dialog open={loadTemplateOpen} onOpenChange={setLoadTemplateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Load Week Template</DialogTitle>
              <DialogDescription>
                Choose a saved template to load into <strong>{week.label}</strong>.
                This will replace all current shifts.
              </DialogDescription>
            </DialogHeader>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No templates saved yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use &quot;Save as Template&quot; to create one from any week.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2 pr-3">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="group flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 mt-0.5">
                        <FolderOpen className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tmpl.name}</p>
                        {tmpl.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {tmpl.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {tmpl.shiftCount} shift{tmpl.shiftCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {tmpl.totalHours.toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(tmpl.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleLoadTemplate(tmpl)}
                        >
                          Load
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setLoadTemplateOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
