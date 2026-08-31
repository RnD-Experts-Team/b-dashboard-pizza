"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  BookmarkPlus,
  FolderOpen,
  AlertTriangle,
  Send,
  Store,
  History,
  CalendarOff,
  CalendarCheck,
  ClipboardCheck,
  GitCompare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { ScheduleGrid } from "./schedule-grid-new";
import { AddShiftDialogNew } from "./add-shift-dialog-new";
import { EditActualShiftDialog } from "./edit-actual-shift-dialog";
import { PublishedSchedules } from "./published-schedules";
import { BulkOperationProgress } from "./bulk-operation-progress";
import {
  ScheduleWarningDialog,
  type ScheduleWarningCode,
} from "./schedule-warning-dialog";
import {
  ScheduleSetupError,
  type SetupErrorCode,
} from "./schedule-setup-error";
import {
  AvailabilityTimeOffDialog,
  type AvailabilityOverrideDraft,
  type TimeOffDraft,
} from "./availability-time-off-dialog";
import { DEFAULT_OVERTIME_THRESHOLD, calcHours, formatTime } from "@/lib/scheduling/constants";

/**
 * Used when an employee has no rate on file.
 * TODO(C1): replace with `store.default_labor_rate` from the week payload.
 */
const FALLBACK_LABOR_RATE = 15;
import {
  DEFAULT_WEEK_START_DOW,
  buildWeekInfo,
  dateForDayIndex,
  shiftIsoDate,
  snapToWeekStart,
  todayIso,
} from "@/lib/scheduling/week";
import { DEPARTMENTS, DUMMY_EMPLOYEES, INITIAL_ACTUAL_SHIFTS, INITIAL_AVAILABILITY, INITIAL_SHIFTS, INITIAL_TIME_OFF, PREVIOUS_WEEK_SHIFTS } from "@/lib/scheduling/dev-fixtures";
import {
  detectConflicts,
  conflictedShiftIds,
  overtimeEmployees,
  mergeActualShifts,
} from "@/lib/scheduling/utils";
import type {
  Shift,
  ScheduleTemplate,
  PublishedSchedule,
  BulkOperation,
  AvailabilityRule,
  TimeOffEntry,
  ActualShift,
  ScheduleMode,
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

export function SchedulingManager() {
  const { selectedStore } = useSelectedStoreStore();
  /**
   * The store_number (e.g. "03795-00001"), NOT the numeric internal id.
   * OperationsPizza scopes every route by store_number; passing `.id` here
   * would 404 on every call.
   */
  const storeId = selectedStore?.storeId ?? selectedStore?.id ?? null;
  void storeId; // TODO(C1): feed into use-schedule-week

  /**
   * The displayed week, as the ISO date of its first day.
   *
   * Deliberately NOT a relative offset: an offset is resolved against
   * `new Date()` on every render, so a tab left open across a week-start
   * midnight would silently re-point every cached week at a different
   * calendar week.
   */
  const [weekStart, setWeekStart] = useState<string>(() =>
    snapToWeekStart(todayIso(), DEFAULT_WEEK_START_DOW)
  );

  /**
   * TODO(C1): replace with the `week` object from the schedule-week payload —
   * the server snaps the date and reports the store's real `week_start_dow`.
   */
  const week = useMemo(
    () => buildWeekInfo(weekStart, DEFAULT_WEEK_START_DOW),
    [weekStart]
  );

  const previousWeekStart = useMemo(
    () => shiftIsoDate(week.start, -7),
    [week.start]
  );

  /** Per-week shift storage keyed by the week's ISO start date. */
  const [allShifts, setAllShifts] = useState<Record<string, Shift[]>>(() => {
    const thisWeek = snapToWeekStart(todayIso(), DEFAULT_WEEK_START_DOW);
    return {
      [thisWeek]: INITIAL_SHIFTS,
      [shiftIsoDate(thisWeek, -7)]: PREVIOUS_WEEK_SHIFTS,
    };
  });

  /** employeeId -> employee, for rate and sync lookups. */
  const employeeLookup = useMemo(
    () => new Map(DUMMY_EMPLOYEES.map((e) => [e.id, e])),
    []
  );

  /** Convenience: shifts visible in the currently displayed week */
  const shifts = allShifts[week.start] ?? [];

  /** Mutate only the current week's slice */
  const setCurrentShifts = useCallback(
    (updater: (prev: Shift[]) => Shift[]) =>
      setAllShifts((all) => ({
        ...all,
        [week.start]: updater(all[week.start] ?? []),
      })),
    [week.start]
  );

  /**
   * Actual-schedule storage, keyed by week start just like allShifts.
   * Each entry links back to a planned Shift via plannedShiftId (or stands
   * alone as ad-hoc "added" coverage).
   */
  const [allActualShifts, setAllActualShifts] = useState<Record<string, ActualShift[]>>(
    () => ({
      [snapToWeekStart(todayIso(), DEFAULT_WEEK_START_DOW)]: INITIAL_ACTUAL_SHIFTS,
    })
  );
  const actualShifts = allActualShifts[week.start] ?? [];
  const setCurrentActualShifts = useCallback(
    (updater: (prev: ActualShift[]) => ActualShift[]) =>
      setAllActualShifts((all) => ({
        ...all,
        [week.start]: updater(all[week.start] ?? []),
      })),
    [week.start]
  );

  // Planned vs Actual toggle + Comparison mode (week view only)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("planned");
  const [comparisonMode, setComparisonMode] = useState(false);

  // Actual-shift edit dialog state
  const [actualDialogOpen, setActualDialogOpen] = useState(false);
  const [editingActualTarget, setEditingActualTarget] = useState<{
    employeeId: string;
    dayIndex: number;
    plannedShift?: Shift;
    actual?: ActualShift;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [isEmployeeScreenshot, setIsEmployeeScreenshot] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedSchedules, setPublishedSchedules] = useState<PublishedSchedule[]>([]);
  const [bulkOperation, setBulkOperation] = useState<BulkOperation | null>(null);
  /**
   * Set when the week fetch reports STORE_NOT_MAPPED / POSITION_NOT_MAPPED.
   * Stays null until C1 — these are setup failures, not user errors, so they
   * replace the grid entirely rather than surfacing as a toast.
   */
  const [setupError, setSetupError] = useState<{
    code: SetupErrorCode;
    message?: string;
  } | null>(null);
  void setSetupError; // TODO(C1): set from the week fetch's error code
  const [warning, setWarning] = useState<{
    code: ScheduleWarningCode;
    message?: string;
    detail?: string;
  } | null>(null);

  // Template state
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  // Availability & time-off
  const [availability, setAvailability] = useState<AvailabilityRule[]>(INITIAL_AVAILABILITY);
  const [timeOff, setTimeOff] = useState<TimeOffEntry[]>(INITIAL_TIME_OFF);
  const [overtimeThreshold] = useState(DEFAULT_OVERTIME_THRESHOLD);

  const gridRef = useRef<HTMLDivElement>(null);

  // Shift dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    employeeId: string;
    dayIndex: number;
  } | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);


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

  /**
   * Reviewed-only "what really happened" list — planned shifts merged with their
   * linked actual entries, un-reviewed ghosts and no-shows excluded, plus any
   * ad-hoc coverage. Pure planned mode just shows the plan as-is; Actual and
   * Comparison modes both need the merged reality to compute totals/conflicts.
   */
  const displayShifts = useMemo(
    () =>
      scheduleMode === "planned" && !comparisonMode
        ? shifts
        : mergeActualShifts(shifts, actualShifts),
    [scheduleMode, comparisonMode, shifts, actualShifts]
  );

  // Summary stats
  const stats = useMemo(() => {
    const totalHours = displayShifts.reduce(
      (acc, s) => acc + s.durationMinutes / 60,
      0
    );
    const uniqueEmployees = new Set(displayShifts.map((s) => s.employeeId)).size;
    // Per-employee rates rather than a flat $15/h. Note these are CURRENT
    // rates: the API does not return the rate in force on the viewed date, so a
    // past week can show a different cost than it did before someone's raise.
    // TODO(C1): prefer the server's `stats.labor_cost` once the week payload lands.
    const rateFor = (employeeId: string) =>
      employeeLookup.get(employeeId)?.hourlyRate ?? FALLBACK_LABOR_RATE;
    const laborCost = displayShifts.reduce(
      (acc, s) => acc + (s.durationMinutes / 60) * rateFor(s.employeeId),
      0
    );
    return {
      totalHours,
      totalShifts: displayShifts.length,
      activeEmployees: uniqueEmployees,
      laborCost,
    };
  }, [displayShifts, employeeLookup]);

  // Conflict detection
  const conflicts = useMemo(() => detectConflicts(displayShifts), [displayShifts]);
  const conflictIds = useMemo(() => conflictedShiftIds(conflicts), [conflicts]);
  const overtimeEmpIds = useMemo(
    () => overtimeEmployees(displayShifts, overtimeThreshold),
    [displayShifts, overtimeThreshold]
  );

  // Dialog target employee
  const targetEmployee = useMemo(() => {
    const id = editingShift?.employeeId ?? pendingAdd?.employeeId;
    return id ? DUMMY_EMPLOYEES.find((e) => e.id === id) ?? null : null;
  }, [editingShift, pendingAdd]);

  // Actual-shift dialog target employee
  const targetActualEmployee = useMemo(() => {
    const id = editingActualTarget?.employeeId;
    return id ? DUMMY_EMPLOYEES.find((e) => e.id === id) ?? null : null;
  }, [editingActualTarget]);

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
    (startTime: string, endTime: string, label: string, type: Shift["type"], isRecurring: boolean, note: string) => {
      if (editingShift) {
        setCurrentShifts((prev) =>
          prev.map((s) =>
            s.id === editingShift.id
              ? {
                  ...s,
                  startTime,
                  endTime,
                  durationMinutes: Math.round(calcHours(startTime, endTime) * 60),
                  crossesMidnight: endTime <= startTime,
                  label,
                  type,
                  isRecurring,
                  recurringGroupId: isRecurring ? (s.recurringGroupId ?? s.id) : undefined,
                  note: note || undefined,
                }
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
        // TODO(C3): the server assigns both ids; drop the local generation.
        shiftId: `s-${shiftId}`,
        employeeId: pendingAdd.employeeId,
        dayIndex: pendingAdd.dayIndex,
        shiftDate: dateForDayIndex(week, pendingAdd.dayIndex),
        startTime,
        endTime,
        durationMinutes: Math.round(calcHours(startTime, endTime) * 60),
        crossesMidnight: endTime <= startTime,
        isPublished: false,
        syncStatus: "synced",
        origin: "operations",
        label,
        type,
        isRecurring,
        recurringGroupId: isRecurring ? shiftId : undefined,
        note: note || undefined,
      };
      setCurrentShifts((prev) => [...prev, newShift]);
      setPendingAdd(null);
      toast.success("Shift added");
    },
    [pendingAdd, editingShift, setCurrentShifts]
  );

  /** Instantly confirm a ghost/pending planned shift as worked-as-scheduled — no dialog */
  const handleConfirmActualShift = useCallback(
    (plannedShift: Shift) => {
      const newActual: ActualShift = {
        id: `actual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId: plannedShift.employeeId,
        dayIndex: plannedShift.dayIndex,
        shiftDate: plannedShift.shiftDate,
        startTime: plannedShift.startTime,
        endTime: plannedShift.endTime,
        durationMinutes: plannedShift.durationMinutes,
        label: plannedShift.label,
        type: plannedShift.type,
        status: "confirmed",
        plannedShiftId: plannedShift.id,
      };
      setCurrentActualShifts((prev) => [...prev, newActual]);
      toast.success("Marked as worked as planned");
    },
    [setCurrentActualShifts]
  );

  /** Open the actual-shift dialog to edit a linked/ghost shift, or add ad-hoc coverage */
  const handleOpenActualDialog = useCallback(
    (plannedShift: Shift | undefined, actual: ActualShift | undefined) => {
      if (plannedShift) {
        setEditingActualTarget({
          employeeId: plannedShift.employeeId,
          dayIndex: plannedShift.dayIndex,
          plannedShift,
          actual,
        });
      } else if (actual) {
        setEditingActualTarget({
          employeeId: actual.employeeId,
          dayIndex: actual.dayIndex,
          actual,
        });
      }
      setActualDialogOpen(true);
    },
    []
  );

  /** Open the actual-shift dialog blank, for logging ad-hoc coverage */
  const handleAddCoverage = useCallback((employeeId: string, dayIndex: number) => {
    setEditingActualTarget({ employeeId, dayIndex });
    setActualDialogOpen(true);
  }, []);

  /** Save the actual-shift dialog — creates or updates an ActualShift */
  const handleSaveActualShift = useCallback(
    (startTime: string, endTime: string, label: string, type: Shift["type"], note: string) => {
      if (!editingActualTarget) return;
      const { employeeId, dayIndex, plannedShift, actual } = editingActualTarget;

      const status: ActualShift["status"] = !plannedShift
        ? "added"
        : startTime === plannedShift.startTime && endTime === plannedShift.endTime
          ? "confirmed"
          : "modified";

      if (actual) {
        setCurrentActualShifts((prev) =>
          prev.map((a) =>
            a.id === actual.id
              ? {
                  ...a,
                  startTime,
                  endTime,
                  durationMinutes: Math.round(calcHours(startTime, endTime) * 60),
                  label,
                  type,
                  status,
                  note: note || undefined,
                }
              : a
          )
        );
        toast.success("Actual shift updated");
      } else {
        const newActual: ActualShift = {
          id: `actual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          employeeId,
          dayIndex,
          shiftDate: dateForDayIndex(week, dayIndex),
          startTime,
          endTime,
          durationMinutes: Math.round(calcHours(startTime, endTime) * 60),
          label,
          type,
          status,
          plannedShiftId: plannedShift?.id,
          note: note || undefined,
        };
        setCurrentActualShifts((prev) => [...prev, newActual]);
        toast.success(plannedShift ? "Actual shift recorded" : "Coverage added");
      }
      setActualDialogOpen(false);
      setEditingActualTarget(null);
    },
    [editingActualTarget, setCurrentActualShifts]
  );

  /** Mark the shift currently open in the actual-shift dialog as no attendance */
  const handleMarkAbsent = useCallback(() => {
    if (!editingActualTarget) return;
    const { employeeId, dayIndex, plannedShift, actual } = editingActualTarget;

    if (actual) {
      setCurrentActualShifts((prev) =>
        prev.map((a) => (a.id === actual.id ? { ...a, status: "absent" as const } : a))
      );
    } else if (plannedShift) {
      const newActual: ActualShift = {
        id: `actual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId,
        dayIndex,
        shiftDate: plannedShift.shiftDate,
        startTime: plannedShift.startTime,
        endTime: plannedShift.endTime,
        durationMinutes: plannedShift.durationMinutes,
        label: plannedShift.label,
        type: plannedShift.type,
        status: "absent",
        plannedShiftId: plannedShift.id,
      };
      setCurrentActualShifts((prev) => [...prev, newActual]);
    }
    toast.info("Marked as no attendance");
    setActualDialogOpen(false);
    setEditingActualTarget(null);
  }, [editingActualTarget, setCurrentActualShifts]);

  /** Delete an actual entry — reverts linked shifts back to ghost/pending, removes standalone coverage entirely */
  const handleDeleteActualShift = useCallback(
    (actual: ActualShift) => {
      setCurrentActualShifts((prev) => prev.filter((a) => a.id !== actual.id));
      toast.info(actual.plannedShiftId ? "Reverted to planned schedule" : "Coverage removed");
    },
    [setCurrentActualShifts]
  );

  /** TODO(C8): POST /availability-overrides, converting dayIndex -> day_of_week. */
  const handleAddAvailability = useCallback((draft: AvailabilityOverrideDraft) => {
    setAvailability((prev) => [
      ...prev,
      {
        id: `avail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId: draft.employeeId,
        dayIndex: draft.dayIndex,
        date: draft.specificDate,
        allDay: draft.allDay,
        startTime: draft.startTime,
        endTime: draft.endTime,
        reason: draft.reason,
        source: "override",
      },
    ]);
    toast.success("Blocked time added");
  }, []);

  const handleDeleteAvailability = useCallback((rule: AvailabilityRule) => {
    if (rule.source === "employee_profile") {
      toast.error("This comes from the employee's profile and must be changed there");
      return;
    }
    setAvailability((prev) => prev.filter((r) => r.id !== rule.id));
    toast.info("Blocked time removed");
  }, []);

  /** TODO(C8): POST /time-off with a date range; the API expands it per day. */
  const handleAddTimeOff = useCallback(
    (draft: TimeOffDraft) => {
      const timeOffId = `${Date.now()}`;
      const added: TimeOffEntry[] = [];
      week.fullDates.forEach((date, dayIndex) => {
        if (date >= draft.startDate && date <= draft.endDate) {
          added.push({
            id: `${timeOffId}-${dayIndex}`,
            timeOffId,
            employeeId: draft.employeeId,
            dayIndex,
            date,
            type: draft.type,
            label: draft.label,
            status: "approved",
            origin: "operations",
          });
        }
      });
      if (added.length === 0) {
        toast.warning("That date range doesn't overlap the week on screen");
        return;
      }
      setTimeOff((prev) => [...prev, ...added]);
      toast.success(`Time off added for ${added.length} day${added.length !== 1 ? "s" : ""}`);
    },
    [week.fullDates]
  );

  const handleDeleteTimeOff = useCallback((entry: TimeOffEntry) => {
    if (entry.origin === "humanity") {
      toast.error("This leave was approved in the HR system and must be withdrawn there");
      return;
    }
    // Deleting removes every day of the leave, which is what the API does.
    setTimeOff((prev) => prev.filter((e) => e.timeOffId !== entry.timeOffId));
    toast.info("Time off removed");
  }, []);

  const handleGoToToday = useCallback(() => {
    setWeekStart(snapToWeekStart(todayIso(), week.weekStartDow));
  }, [week.weekStartDow]);

  /**
   * Copy previous week's shifts into the current week.
   * Each shift gets a fresh ID to avoid duplicates.
   * dayIndex is preserved (0=Tue … 6=Mon) — it maps 1:1 between weeks.
   */
  const handleConfirmCopyPreviousWeek = useCallback(() => {
    const prevShifts = allShifts[previousWeekStart] ?? [];
    if (prevShifts.length === 0) {
      toast.warning("No shifts found in the previous week");
      return;
    }
    const copied: Shift[] = prevShifts.map((s, i) => {
      const id = `shift-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        ...s,
        id,
        shiftId: `s-${id}`,
        // dayIndex maps 1:1 between weeks, but the absolute date must move.
        shiftDate: dateForDayIndex(week, s.dayIndex),
      };
    });
    setAllShifts((all) => ({ ...all, [week.start]: copied }));
    toast.success(
      `Copied ${copied.length} shift${copied.length !== 1 ? "s" : ""} from the previous week`
    );
  }, [allShifts, previousWeekStart, week.start]);

  /** Derived: does the previous week have any shifts? Used to disable the menu item. */
  const hasPreviousWeekShifts = (allShifts[previousWeekStart] ?? []).length > 0;

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
      (acc, s) => acc + s.durationMinutes / 60,
      0
    );
    const template: ScheduleTemplate = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      createdAt: new Date().toISOString(),
      shifts: shifts.map((s) => ({
        employeeId: s.employeeId,
        dayIndex: s.dayIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.label,
        type: s.type,
        note: s.note,
      })),
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
      const loaded: Shift[] = (template.shifts ?? []).map((s, i) => {
        const id = `shift-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
        return {
          ...s,
          id,
          shiftId: `s-${id}`,
          shiftDate: dateForDayIndex(week, s.dayIndex),
          durationMinutes: Math.round(calcHours(s.startTime, s.endTime) * 60),
          crossesMidnight: s.endTime <= s.startTime,
          isPublished: false,
          syncStatus: "synced" as const,
          origin: "operations" as const,
        };
      });
      setAllShifts((all) => ({ ...all, [week.start]: loaded }));
      setLoadTemplateOpen(false);
      toast.success(
        `Loaded template "${template.name}" — ${loaded.length} shift${loaded.length !== 1 ? "s" : ""}`
      );
    },
    [week.start]
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
        ...week.dayNamesShort.map((d, i) => `${d} ${week.dayDates[i] ?? ""}`),
        "Total Hours",
        "Total Shifts",
      ];

      const rows: string[][] = [headers];

      for (const emp of DUMMY_EMPLOYEES) {
        let totalHours = 0;
        let totalShifts = 0;
        const dayCells = week.dayNamesShort.map((_, dayIdx) => {
          const dayShifts = shifts.filter(
            (s) => s.employeeId === emp.id && s.dayIndex === dayIdx
          );
          if (dayShifts.length === 0) return "—";
          totalShifts += dayShifts.length;
          return dayShifts
            .map((s) => {
              const h = s.durationMinutes / 60;
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
        ...week.dayNamesShort.map((_, dayIdx) => {
          const h = shifts
            .filter((s) => s.dayIndex === dayIdx)
            .reduce((acc, s) => acc + s.durationMinutes / 60, 0);
          return h > 0 ? `${h.toFixed(1)}h` : "—";
        }),
        `${shifts.reduce((acc, s) => acc + s.durationMinutes / 60, 0).toFixed(1)}h`,
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

  /** Capture an employee-facing screenshot (no hours, totals, or time-off) */
  /**
   * Publish the current week.
   *
   * Uses the EMPLOYEE view (no hours, totals or time off) because that is what
   * actually gets posted in store, and `canvas.toBlob` rather than
   * `toDataURL` — at scale 2 a 10x7 grid is 1-3 MB, which has no business
   * travelling as base64 inside a JSON body.
   *
   * TODO(C9): POST multipart to /published-schedules and let the browser set
   * the Content-Type boundary itself.
   */
  const handlePublishWeek = useCallback(async () => {
    setIsPublishing(true);
    setIsEmployeeScreenshot(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const target = gridRef.current;
      if (!target) return;
      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) {
        toast.error("Could not render the schedule image");
        return;
      }

      setPublishedSchedules((prev) => [
        {
          id: `pub-${Date.now()}`,
          weekStartDate: week.start,
          weekLabel: week.label,
          publishedAt: new Date().toISOString(),
          screenshotUrl: URL.createObjectURL(blob),
          shiftCount: shifts.length,
          totalHours: shifts.reduce((acc, sh) => acc + sh.durationMinutes / 60, 0),
        },
        // Re-publishing a week supersedes the previous record for it.
        ...prev.map((rec) =>
          rec.weekStartDate === week.start && !rec.unpublishedAt
            ? { ...rec, unpublishedAt: new Date().toISOString() }
            : rec
        ),
      ]);
      toast.success(`Published ${week.label}`);
    } catch {
      toast.error("Could not publish this week");
    } finally {
      setIsEmployeeScreenshot(false);
      setIsPublishing(false);
    }
  }, [week.start, week.label, shifts]);

  const handleDeletePublished = useCallback((id: string) => {
    setPublishedSchedules((prev) => prev.filter((p) => p.id !== id));
    toast.info("Published schedule deleted");
  }, []);

  /** TODO(C7): POST /schedule/bulk/clear-week with confirm:true, then poll. */
  const handleConfirmClearWeek = useCallback(() => {
    setCurrentShifts(() => []);
    setClearConfirmOpen(false);
    toast.info("Week cleared");
  }, [setCurrentShifts]);

  const handleEmployeeScreenshot = useCallback(async () => {
    setIsEmployeeScreenshot(true);
    // Give React one tick to re-render with employeeView=true
    await new Promise((r) => setTimeout(r, 100));
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
      a.download = `schedule-employees-${week.label.replace(/[^a-z0-9]/gi, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("Employee schedule screenshot downloaded");
    } catch {
      toast.error("Screenshot failed");
    } finally {
      setIsEmployeeScreenshot(false);
    }
  }, [week.label]);

  if (setupError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Employee Schedule"
          description="Manage weekly shifts for your team"
        />
        <ScheduleSetupError
          code={setupError.code}
          message={setupError.message}
          storeLabel={selectedStore?.name ?? selectedStore?.storeId ?? null}
        />
      </div>
    );
  }

  if (!selectedStore) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Employee Schedule"
          description="Manage weekly shifts for your team"
        />
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="rounded-full bg-muted p-2.5">
              <Store className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold">No Store Selected</h3>
              <p className="max-w-sm text-[11px] text-muted-foreground">
                Select a store from the sidebar to view and edit its schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              onClick={() => setWeekStart((w) => shiftIsoDate(w, -7))}
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
              onClick={() => setWeekStart((w) => shiftIsoDate(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {week.start !== snapToWeekStart(todayIso(), week.weekStartDow) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleGoToToday}
              >
                Today
              </Button>
            )}

            <div
              className={cn(
                "flex items-center rounded-md border bg-muted/40 p-0.5 ml-2 transition-opacity",
                comparisonMode && "opacity-50 pointer-events-none"
              )}
            >
              <Button
                variant={scheduleMode === "planned" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() => setScheduleMode("planned")}
                disabled={comparisonMode}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Planned
              </Button>
              <Button
                variant={scheduleMode === "actual" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() => setScheduleMode("actual")}
                disabled={comparisonMode}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Actual
              </Button>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={comparisonMode ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs ml-1"
                  onClick={() => setComparisonMode((c) => !c)}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Comparison always shows both planned and actual times side by side
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-45 pl-8 text-sm"
              />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-sm"
                  onClick={() => setAvailabilityOpen(true)}
                >
                  <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
                  Availability
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Manage blocked times and time off for this week
              </TooltipContent>
            </Tooltip>

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
                <DropdownMenuItem
                  disabled={shifts.length === 0}
                  onSelect={() => setClearConfirmOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Clear Week
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Publish
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isPublishing || shifts.length === 0}
                  onSelect={handlePublishWeek}
                  className="gap-2 cursor-pointer"
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  ) : (
                    <Send className="h-4 w-4 text-emerald-600" />
                  )}
                  Publish Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setPublishedOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <History className="h-4 w-4 text-sky-600" />
                  Published History
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
                <DropdownMenuItem
                  disabled={isEmployeeScreenshot}
                  onSelect={handleEmployeeScreenshot}
                  className="gap-2 cursor-pointer"
                >
                  {isEmployeeScreenshot ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-sky-600" />
                  )}
                  Employee Screenshot
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
                  Est. Labor (current rates)
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

        {/* The schedule view — week grid */}
        <div ref={gridRef}>
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
            employeeView={isEmployeeScreenshot}
            scheduleMode={scheduleMode}
            comparisonMode={comparisonMode}
            actualShifts={actualShifts}
            displayShifts={displayShifts}
            onConfirmActual={handleConfirmActualShift}
            onEditActual={handleOpenActualDialog}
            onDeleteActual={handleDeleteActualShift}
          onAddCoverage={handleAddCoverage}
        />

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
              ? week.dayNames[editingShift.dayIndex]
              : pendingAdd
                ? week.dayNames[pendingAdd.dayIndex]
                : ""
          }
          dayIndex={editingShift?.dayIndex ?? pendingAdd?.dayIndex ?? 0}
          currentShifts={shifts}
          availability={availability}
          timeOff={timeOff}
          onConfirm={handleConfirmShift}
          editingShift={editingShift}
        />

        {/* Availability & time off */}
        <AvailabilityTimeOffDialog
          open={availabilityOpen}
          onOpenChange={setAvailabilityOpen}
          week={week}
          employees={DUMMY_EMPLOYEES}
          availability={availability}
          timeOff={timeOff}
          onAddAvailability={handleAddAvailability}
          onDeleteAvailability={handleDeleteAvailability}
          onAddTimeOff={handleAddTimeOff}
          onDeleteTimeOff={handleDeleteTimeOff}
        />

        {/* Published history */}
        <Dialog open={publishedOpen} onOpenChange={setPublishedOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Published schedules</DialogTitle>
              <DialogDescription>
                Weeks that have been published for staff. Re-publishing a week
                supersedes its previous record.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <PublishedSchedules
                schedules={publishedSchedules}
                onDelete={handleDeletePublished}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPublishedOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Overridable refusals (conflict / unavailable / on leave / published) */}
        <ScheduleWarningDialog
          code={warning?.code ?? null}
          message={warning?.message}
          detail={warning?.detail}
          onConfirm={() => setWarning(null)}
          onCancel={() => setWarning(null)}
        />

        {/* Async bulk operation progress */}
        <BulkOperationProgress
          operation={bulkOperation}
          onRetryFailed={() => undefined}
          onClose={() => setBulkOperation(null)}
        />

        {/* Clear week confirmation */}
        <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear this week?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes all <strong>{shifts.length}</strong> shift
                {shifts.length !== 1 ? "s" : ""} in <strong>{week.label}</strong>.
                Employees may already be working from this schedule, and this
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmClearWeek}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Clear week
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Actual Shift dialog */}
        <EditActualShiftDialog
          open={actualDialogOpen}
          onOpenChange={(open) => {
            setActualDialogOpen(open);
            if (!open) setEditingActualTarget(null);
          }}
          employee={targetActualEmployee}
          dayLabel={editingActualTarget ? week.dayNames[editingActualTarget.dayIndex] : ""}
          plannedShift={editingActualTarget?.plannedShift}
          editingActual={editingActualTarget?.actual}
          onSave={handleSaveActualShift}
          onMarkAbsent={handleMarkAbsent}
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
