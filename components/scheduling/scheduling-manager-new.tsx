"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleErrorAlert } from "./schedule-error-alert";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useScheduleWeek } from "@/lib/hooks/use-schedule-week";
import { useShiftMutations } from "@/lib/hooks/use-shift-mutations";
import { useActualShiftMutations } from "@/lib/hooks/use-actual-shift-mutations";
import { useScheduleTemplates } from "@/lib/hooks/use-schedule-templates";
import { usePublishedSchedules } from "@/lib/hooks/use-published-schedules";
import { useBulkOperation } from "@/lib/hooks/use-bulk-operation";
import {
  useScheduleDraftStore,
  useWeekDrafts,
  useWeekDraftSaveMode,
  type DraftShift,
} from "@/lib/scheduling/draft.store";
import { DraftActionBar } from "./draft-action-bar";
import {
  useUnsavedShiftsGuard,
  UnsavedShiftsDialog,
} from "./unsaved-shifts-guard";
import { useAvailabilityMutations } from "@/lib/hooks/use-availability-mutations";
import {
  schedulingService,
  handleUnauthorized,
} from "@/lib/api/services/scheduling.service";
import { adaptScheduleWeek } from "@/lib/scheduling/adapters";
import { parseSchedulingError } from "@/lib/scheduling/errors";
import { ScheduleGrid } from "./schedule-grid-new";
import { AddShiftDialogNew } from "./add-shift-dialog-new";
import { EditActualShiftDialog } from "./edit-actual-shift-dialog";
import { PublishedSchedules } from "./published-schedules";
import { BulkOperationProgress } from "./bulk-operation-progress";
import { ScheduleWarningDialog } from "./schedule-warning-dialog";
import {
  ScheduleSetupError,
  type SetupErrorCode,
} from "./schedule-setup-error";
import {
  AvailabilityTimeOffDialog,
  type AvailabilityOverrideDraft,
  type TimeOffDraft,
} from "./availability-time-off-dialog";
import {
  DEFAULT_OVERTIME_THRESHOLD,
  calcHours,
  formatTime,
} from "@/lib/scheduling/constants";

/**
 * Last-resort rate, used only when an employee has no rate on file AND the
 * store's own `defaultLaborRate` has not loaded yet. The resolution order is
 * employee rate -> store default -> this.
 */
const FALLBACK_LABOR_RATE = 15;

/** Stable empty arrays — a fresh `[]` each render would invalidate every memo. */
const NO_SHIFTS: Shift[] = [];
const NO_ACTUAL_SHIFTS: ActualShift[] = [];
const NO_AVAILABILITY: AvailabilityRule[] = [];
const NO_TIME_OFF: TimeOffEntry[] = [];
import {
  DEFAULT_WEEK_START_DOW,
  buildWeekInfo,
  dateForDayIndex,
  formatIsoDateWithWeekday,
  shiftIsoDate,
  snapToWeekStart,
  todayIso,
  formatTimestamp,
} from "@/lib/scheduling/week";
import {
  conflictedShiftIds,
  mergeActualShifts,
} from "@/lib/scheduling/utils";
import type {
  Shift,
  ScheduleTemplate,
  ScheduleEmployee,
  ScheduleDepartment,
  ScheduleStats,
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

  /**
   * The displayed week, as the ISO date of its first day.
   *
   * Deliberately NOT a relative offset: an offset is resolved against
   * `new Date()` on every render, so a tab left open across a week-start
   * midnight would silently re-point every cached week at a different
   * calendar week. The server snaps whatever date we send to the store's true
   * week start and reports it back.
   */
  const [weekStart, setWeekStart] = useState<string>(() =>
    snapToWeekStart(todayIso(), DEFAULT_WEEK_START_DOW)
  );

  // Planned vs Actual toggle + Comparison mode
  const [scheduleMode, setScheduleMode] = useState<"planned" | "actual">("planned");
  const [comparisonMode, setComparisonMode] = useState(false);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");

  /**
   * Comparison needs planned and actual together; otherwise fetch only what is
   * rendered so we are not paying for actuals the UI will discard.
   */
  const apiMode: ScheduleMode = comparisonMode ? "both" : scheduleMode;

  const {
    data,
    isLoading,
    isRefetching,
    error: weekError,
    setupError,
    refetch,
  } = useScheduleWeek({ storeId, weekStart, mode: apiMode, department, search });

  /**
   * Render from the server's week object once it arrives. The local fallback
   * only covers the very first paint, before any payload exists.
   */
  const week = useMemo(
    () => data?.week ?? buildWeekInfo(weekStart, DEFAULT_WEEK_START_DOW),
    [data?.week, weekStart]
  );

  const employees: ScheduleEmployee[] = data?.employees ?? [];
  const departments: ScheduleDepartment[] = data?.departments ?? [];
  const store = data?.store ?? null;
  const overtimeThreshold = store?.overtimeThresholdHours ?? DEFAULT_OVERTIME_THRESHOLD;

  /** employeeId -> employee, for rate and sync lookups. */
  const employeeLookup = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  /**
   * Read straight from the payload — there is no local copy.
   *
   * Every write goes to the API and is followed by a refetch, so a mirror would
   * only add a frame where the screen disagrees with the server. The shared
   * empty arrays keep referential identity stable while `data` is null, so the
   * memos below do not churn.
   */
  const shifts = data?.shifts ?? NO_SHIFTS;
  const actualShifts = data?.actualShifts ?? NO_ACTUAL_SHIFTS;
  const availability = data?.availability ?? NO_AVAILABILITY;
  const timeOff = data?.timeOff ?? NO_TIME_OFF;

  // Actual-shift edit dialog state
  const [actualDialogOpen, setActualDialogOpen] = useState(false);
  const [editingActualTarget, setEditingActualTarget] = useState<{
    employeeId: string;
    dayIndex: number;
    plannedShift?: Shift;
    actual?: ActualShift;
  } | null>(null);

  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [isEmployeeScreenshot, setIsEmployeeScreenshot] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [publishedOpen, setPublishedOpen] = useState(false);
  /**
   * A setup failure surfaced by a WRITE rather than the initial fetch. The hook
   * reports fetch-time ones separately; either replaces the grid.
   */
  const [writeSetupError, setWriteSetupError] = useState<{
    code: SetupErrorCode;
    message: string;
  } | null>(null);

  const bulk = useBulkOperation({
    storeId,
    onSettled: (operation) => {
      refetch();
      /**
       * A whole-batch failure means nothing was created, so the manager's layout
       * must come back rather than vanish. Per-item failures are NOT restored —
       * those are recoverable server-side through `retry-failed`, which the
       * progress dialog already offers, and re-drafting them would double up.
       */
      if (operation?.status === "failed" && lastSubmittedDraftsRef.current.length) {
        // `onSettled` lives in a ref that is refreshed every render, so these
        // read current values rather than the ones from mount.
        replaceDraftWeek(
          storeId!,
          week.start,
          lastSubmittedDraftsRef.current.map(({ draftId: _drop, ...rest }) => rest),
          "merge"
        );
        lastSubmittedDraftsRef.current = [];
        toast.error("Nothing was saved — your shifts have been put back.");
      }
    },
  });

  const templates = useScheduleTemplates({ storeId });

  const published = usePublishedSchedules({
    storeId,
    onSuccess: (message) => toast.success(message),
  });

  const availabilityMutations = useAvailabilityMutations({
    storeId,
    // The week payload carries the store's real week start, which the
    // day_index -> day_of_week conversion depends on.
    weekStartDow: week.weekStartDow,
    refetchWeek: refetch,
    onSuccess: (message) => toast.success(message),
    onRefused: (message) => toast.error(message),
  });

  const actualMutations = useActualShiftMutations({
    storeId,
    refetchWeek: refetch,
    onSuccess: (message) => toast.success(message),
  });

  const mutations = useShiftMutations({
    storeId,
    refetchWeek: refetch,
    onSetupError: (code, message) => setWriteSetupError({ code, message }),
    onSuccess: (kind) => {
      toast.success(
        kind === "delete"
          ? "Shift removed"
          : kind === "update"
            ? "Shift updated"
            : "Shift added"
      );
      if (kind !== "delete") {
        // Also covers the replay that fires once an employee finishes setup,
        // which does not run through the caller's promise chain.
        setShiftDialogOpen(false);
        setPendingAdd(null);
        setEditingShift(null);
      }
    },
  });

  // Template dialog state (the list itself lives in useScheduleTemplates)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);

  // Shift dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    employeeId: string;
    dayIndex: number;
  } | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  /** Set when the dialog is editing an UNSAVED shift rather than a saved one. */
  const [editingDraft, setEditingDraft] = useState<DraftShift | null>(null);
  const [cancelDraftsOpen, setCancelDraftsOpen] = useState(false);
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);
  /** The set most recently submitted, so a failed batch can be restored. */
  const lastSubmittedDraftsRef = useRef<DraftShift[]>([]);

  /* ── Drafts ──────────────────────────────────────────────────────────────
   * Adding a shift is local until Save. Drafts are persisted per store + week,
   * so changing week or store parks them rather than losing them.
   */
  const drafts = useWeekDrafts(storeId, week.start);
  const draftSaveMode = useWeekDraftSaveMode(storeId, week.start);
  const addDraft = useScheduleDraftStore((st) => st.addDraft);
  const updateDraft = useScheduleDraftStore((st) => st.updateDraft);
  const removeDraft = useScheduleDraftStore((st) => st.removeDraft);
  const clearDraftWeek = useScheduleDraftStore((st) => st.clearWeek);
  const replaceDraftWeek = useScheduleDraftStore((st) => st.replaceWeek);
  const pruneExpiredDrafts = useScheduleDraftStore((st) => st.pruneExpired);

  useEffect(() => {
    pruneExpiredDrafts();
  }, [pruneExpiredDrafts]);

  const hasDrafts = drafts.length > 0;

  /** Warns before any action that moves away from drafted shifts. */
  const guard = useUnsavedShiftsGuard({ hasDrafts, draftCount: drafts.length });


  /**
   * The roster, already filtered by the server.
   *
   * `department` and `search` are sent with the week request, and the server
   * filters the roster AND the shifts together — so a filtered grid never shows
   * a card with no row to sit on. Filtering again here would double-filter.
   */
  const filteredEmployees = employees;

  /** "All" plus the store's mapped Humanity positions, from the payload. */
  const departmentOptions = useMemo(
    () => ["All", ...departments.map((d) => d.name)],
    [departments]
  );

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

  /**
   * Summary stats.
   *
   * In planned mode the server's `stats` wins outright — it is computed from the
   * same `duration_minutes` values and includes a labor cost resolved per
   * employee, so recomputing here could only disagree with it.
   *
   * Actual and comparison modes have no server equivalent: `stats` describes the
   * PLAN. Those totals are derived locally from the merged reality, still using
   * `durationMinutes` rather than wall-clock arithmetic.
   *
   * Note the rates behind the local figure are each employee's CURRENT rate —
   * the API does not expose the rate in force on the viewed date — so a past
   * week's cost can change after someone's raise.
   */
  const isPlannedOnly = scheduleMode === "planned" && !comparisonMode;

  /**
   * Guard a view-mode change, but only when it moves AWAY from planned.
   *
   * Drafts live in the planned view: that is where they render and where Save
   * lives. Switching back to planned brings them into view, so warning there is
   * backwards — it asks the manager to confirm returning to their own work.
   * Only leaving planned hides them, so only that direction warrants a warning.
   */
  const requestModeChange = useCallback(
    (targetIsPlanned: boolean, run: () => void) => {
      if (isPlannedOnly && !targetIsPlanned) {
        guard.requestAction(run);
        return;
      }
      run();
    },
    // `guard` is a fresh object each render; `requestAction` is the stable part.
    [isPlannedOnly, guard.requestAction]
  );

  const stats = useMemo<ScheduleStats>(() => {
    // The server's figures describe SAVED shifts only, so once drafts exist
    // they would be stale — the manager would add five shifts and watch the
    // totals refuse to move. Fall through to the local calculation instead.
    if (isPlannedOnly && data?.stats && !hasDrafts) return data.stats;

    // Drafts have no server-computed duration, so their hours come from the
    // times on screen. Wall-clock is acceptable here and nowhere else: these
    // shifts are not saved, so no payroll figure depends on them yet.
    const draftMinutes = isPlannedOnly
      ? drafts.reduce(
          (acc, d) => acc + Math.round(calcHours(d.startTime, d.endTime) * 60),
          0
        )
      : 0;
    const totalHours =
      displayShifts.reduce((acc, s) => acc + s.durationMinutes / 60, 0) +
      draftMinutes / 60;
    const rateFor = (employeeId: string) =>
      employeeLookup.get(employeeId)?.hourlyRate ??
      store?.defaultLaborRate ??
      FALLBACK_LABOR_RATE;
    const countedDrafts = isPlannedOnly ? drafts : [];
    return {
      totalHours,
      totalShifts: displayShifts.length + countedDrafts.length,
      activeEmployees: new Set([
        ...displayShifts.map((s) => s.employeeId),
        ...countedDrafts.map((d) => d.employeeId),
      ]).size,
      laborCost:
        displayShifts.reduce(
          (acc, s) => acc + (s.durationMinutes / 60) * rateFor(s.employeeId),
          0
        ) +
        countedDrafts.reduce(
          (acc, d) =>
            acc + calcHours(d.startTime, d.endTime) * rateFor(d.employeeId),
          0
        ),
    };
  }, [
    isPlannedOnly,
    data?.stats,
    displayShifts,
    employeeLookup,
    store?.defaultLaborRate,
    hasDrafts,
    drafts,
  ]);

  /**
   * Conflicts and overtime, authoritative from the server.
   *
   * The server computes conflicts on UTC INSTANTS, so it catches a 22:00-02:00
   * shift colliding with the next morning's 01:00-09:00 one — precisely the
   * overnight double-booking a wall-clock client check misses. Never re-derive
   * these locally.
   *
   * Both describe the PLAN, so in actual/comparison mode they are left empty
   * rather than shown against merged data they were not computed from.
   */
  const conflicts = useMemo(
    () => (isPlannedOnly ? (data?.conflicts ?? []) : []),
    [isPlannedOnly, data?.conflicts]
  );
  const conflictIds = useMemo(() => conflictedShiftIds(conflicts), [conflicts]);
  const overtimeEmpIds = useMemo(
    () => (isPlannedOnly ? (data?.overtimeEmployeeIds ?? new Set<string>()) : new Set<string>()),
    [isPlannedOnly, data?.overtimeEmployeeIds]
  );

  // Dialog target employee
  const targetEmployee = useMemo(() => {
    const id =
      editingDraft?.employeeId ??
      editingShift?.employeeId ??
      pendingAdd?.employeeId;
    return id ? employeeLookup.get(id) ?? null : null;
  }, [editingShift, editingDraft, pendingAdd, employeeLookup]);

  // Actual-shift dialog target employee
  const targetActualEmployee = useMemo(() => {
    const id = editingActualTarget?.employeeId;
    return id ? employeeLookup.get(id) ?? null : null;
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

  /**
   * Delete a shift.
   *
   * Addresses `shiftId` — the SHIFT — not the assignment id the card carries as
   * `id`. One Humanity shift can hold several employees, so an assignment id
   * would address the wrong thing or 404.
   *
   * No optimistic removal. If the write fails the shift is still live for the
   * employee, and a card that vanished locally but not upstream is the worst
   * divergence this system can produce.
   */
  const handleDeleteShift = useCallback(
    (assignmentId: string) => {
      const shift = shifts.find((s) => s.id === assignmentId);
      if (!shift) return;
      const who = employeeLookup.get(shift.employeeId)?.name ?? "This employee";
      void mutations.deleteShift(shift.shiftId, {
        detail: `${who} · ${formatIsoDateWithWeekday(shift.shiftDate)} · ${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`,
      });
    },
    [shifts, employeeLookup, mutations]
  );

  /**
   * Save the add/edit shift dialog.
   *
   * Three destinations:
   *   new shift        -> a local DRAFT, no request. Submitted later in one
   *                      bulk call when the manager presses Save.
   *   saved shift      -> straight to the API, exactly as before. Editing an
   *                      existing shift is not draftable, because the bulk
   *                      endpoint only creates.
   *   unsaved draft    -> update the draft in place.
   */
  const handleConfirmShift = useCallback(
    (
      startTime: string,
      endTime: string,
      label: string,
      type: Shift["type"],
      isRecurring: boolean,
      note: string
    ) => {
      // Editing an unsaved shift never touches the network.
      if (editingDraft) {
        updateDraft(storeId!, week.start, editingDraft.draftId, {
          startTime,
          endTime,
          label,
          type,
          note: note || undefined,
        });
        setShiftDialogOpen(false);
        setEditingDraft(null);
        return;
      }

      const target = editingShift
        ? { employeeId: editingShift.employeeId, dayIndex: editingShift.dayIndex }
        : pendingAdd;
      if (!target) return;

      // A new shift becomes a draft. Nothing is sent yet.
      if (!editingShift) {
        addDraft(storeId!, week.start, {
          employeeId: target.employeeId,
          dayIndex: target.dayIndex,
          startTime,
          endTime,
          label,
          type,
          note: note || undefined,
        });
        setShiftDialogOpen(false);
        setPendingAdd(null);
        return;
      }

      const who = employeeLookup.get(target.employeeId)?.name ?? "This employee";
      // The absolute date comes from the week payload — never computed here.
      const shiftDate = dateForDayIndex(week, target.dayIndex);
      const detail = `${who} · ${formatIsoDateWithWeekday(shiftDate)} · ${formatTime(startTime)} – ${formatTime(endTime)}`;

      const payload: Record<string, unknown> = {
        employee_id: Number(target.employeeId) || target.employeeId,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        label: label || undefined,
        shift_type: type,
        note: note || undefined,
      };

      void mutations.updateShift(editingShift.shiftId, payload, {
        employeeId: target.employeeId,
        detail,
      });
    },
    [
      pendingAdd,
      editingShift,
      editingDraft,
      employeeLookup,
      week,
      mutations,
      storeId,
      addDraft,
      updateDraft,
    ]
  );

  /**
   * Submit every drafted shift in one request.
   *
   * `day_index` is week-relative, which is exactly what the grid carries — no
   * date maths on the way out. The endpoint caps a request at 500 shifts; beyond
   * that it is split, and only the FIRST batch may carry `replace`, since
   * repeating it would delete what the previous batch just created.
   */
  const handleSaveDrafts = useCallback(() => {
    if (!storeId || drafts.length === 0) return;

    const MAX_PER_REQUEST = 500;
    const batches: DraftShift[][] = [];
    for (let i = 0; i < drafts.length; i += MAX_PER_REQUEST) {
      batches.push(drafts.slice(i, i + MAX_PER_REQUEST));
    }

    // Held so a total batch failure can put the manager's layout back.
    lastSubmittedDraftsRef.current = drafts;

    void bulk
      .run(
        async () => {
          let last: unknown = null;
          for (const [index, batch] of batches.entries()) {
            last = await schedulingService.bulkCreateShifts(storeId, {
              week_start: week.start,
              mode: index === 0 ? draftSaveMode : "merge",
              shifts: batch.map((d) => ({
                employee_id: Number(d.employeeId) || d.employeeId,
                day_index: d.dayIndex,
                start_time: d.startTime,
                end_time: d.endTime,
                label: d.label || undefined,
                shift_type: d.type || undefined,
                note: d.note || undefined,
              })),
            });
          }
          return last;
        },
        { fallbackMessage: "Could not save these shifts." }
      )
      .then((accepted) => {
        /**
         * Only clear once the batch has actually been ACCEPTED. Clearing on
         * submit would throw the manager's layout away on a rejected request,
         * even though nothing was written. If the batch later fails outright,
         * `onSettled` puts the drafts back.
         */
        if (accepted) clearDraftWeek(storeId, week.start);
      });
  }, [storeId, drafts, draftSaveMode, week.start, bulk, clearDraftWeek]);

  const handleCancelDrafts = useCallback(() => {
    setCancelDraftsOpen(false);
    if (!storeId) return;
    clearDraftWeek(storeId, week.start);
    refetch();
    toast.info("Unsaved shifts discarded");
  }, [storeId, week.start, clearDraftWeek, refetch]);

  const handleEditDraft = useCallback((draft: DraftShift) => {
    setEditingDraft(draft);
    setEditingShift(null);
    setPendingAdd(null);
    setShiftDialogOpen(true);
  }, []);

  const handleDeleteDraft = useCallback(
    (draftId: string) => {
      removeDraft(storeId!, week.start, draftId);
      toast.info("Unsaved shift removed");
    },
    [removeDraft, storeId, week.start]
  );

  /** One-click "worked exactly as planned" — no dialog, addresses the assignment. */
  const handleConfirmActualShift = useCallback(
    (plannedShift: Shift) => {
      void actualMutations.confirmAsPlanned(plannedShift);
    },
    [actualMutations]
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

  /**
   * Save the actual-shift dialog.
   *
   * `status` is NOT computed here any more — the server derives it from the
   * times and sends it back. The old local derivation compared only start and
   * end, so a label-only change was reported as "confirmed" even though the type
   * itself documents that as "modified".
   *
   * Three cases, and they need different endpoints:
   *
   *   Linked to a planned shift -> post with the ASSIGNMENT id, which amends
   *   that assignment's actual rather than stacking a duplicate.
   *
   *   Editing existing AD-HOC coverage -> there is no assignment behind it, so
   *   it must address the actual's own id. Posting to the collection endpoint
   *   without an assignment id would create a SECOND coverage row.
   *
   *   Brand-new ad-hoc coverage -> post with no assignment id.
   */
  const handleSaveActualShift = useCallback(
    (startTime: string, endTime: string, label: string, type: Shift["type"], note: string) => {
      if (!editingActualTarget) return;
      const { employeeId, dayIndex, plannedShift, actual } = editingActualTarget;

      const done = (ok: boolean) => {
        if (ok) {
          setActualDialogOpen(false);
          setEditingActualTarget(null);
        }
      };

      if (!plannedShift && actual) {
        void actualMutations
          .updateActual(actual.id, { startTime, endTime, label, shiftType: type, note })
          .then(done);
        return;
      }

      void actualMutations
        .saveActual({
          employeeId,
          shiftDate: plannedShift?.shiftDate ?? dateForDayIndex(week, dayIndex),
          startTime,
          endTime,
          label,
          shiftType: type,
          note,
          assignmentId: plannedShift?.id,
        })
        .then(done);
    },
    [editingActualTarget, week, actualMutations]
  );

  /** Mark a planned shift as a no-show. */
  const handleMarkAbsent = useCallback(() => {
    if (!editingActualTarget) return;
    const { plannedShift, actual } = editingActualTarget;

    /**
     * The absent endpoint addresses an ACTUAL. When a planned shift has not been
     * reviewed yet there is no actual to mark, so one is created from the plan
     * first and then flipped — two calls, but it keeps the client from having to
     * assert a status the server owns.
     */
    const run = async () => {
      let target = actual;
      if (!target && plannedShift) {
        const created = await actualMutations.saveActual({
          employeeId: plannedShift.employeeId,
          shiftDate: plannedShift.shiftDate,
          startTime: plannedShift.startTime,
          endTime: plannedShift.endTime,
          label: plannedShift.label,
          shiftType: plannedShift.type,
          assignmentId: plannedShift.id,
        });
        if (!created) return;
        // The refetch that follows brings the new actual back with its id.
        setActualDialogOpen(false);
        setEditingActualTarget(null);
        toast.info("Recorded — mark it as a no-show from the card once it appears.");
        return;
      }
      if (!target) return;
      const ok = await actualMutations.markAbsent(target);
      if (ok) {
        setActualDialogOpen(false);
        setEditingActualTarget(null);
      }
    };

    void run();
  }, [editingActualTarget, actualMutations]);

  const handleDeleteActualShift = useCallback(
    (actual: ActualShift) => {
      void actualMutations.deleteActual(actual);
    },
    [actualMutations]
  );

  const handleAddAvailability = useCallback(
    (draft: AvailabilityOverrideDraft) => {
      void availabilityMutations.addAvailability(draft);
    },
    [availabilityMutations]
  );

  const handleDeleteAvailability = useCallback(
    (rule: AvailabilityRule) => {
      void availabilityMutations.deleteAvailability(rule);
    },
    [availabilityMutations]
  );

  const handleAddTimeOff = useCallback(
    (draft: TimeOffDraft) => {
      void availabilityMutations.addTimeOff(draft);
    },
    [availabilityMutations]
  );

  const handleDeleteTimeOff = useCallback(
    (entry: TimeOffEntry) => {
      void availabilityMutations.deleteTimeOff(entry);
    },
    [availabilityMutations]
  );

  const handleGoToToday = useCallback(() => {
    setWeekStart(snapToWeekStart(todayIso(), week.weekStartDow));
  }, [week.weekStartDow]);

  /**
   * Copy the previous week in as DRAFTS.
   *
   * Fetches last week rather than calling the server-side copy endpoint, so the
   * manager can review and adjust before anything is written. The copied set
   * describes the whole intended week, so it saves with `mode: "replace"` — that
   * is the only place replace is used, and it is why the confirm dialog says the
   * current schedule will be replaced.
   */
  const handleConfirmCopyPreviousWeek = useCallback(async () => {
    setCopyConfirmOpen(false);
    if (!storeId) return;

    setIsCopyingWeek(true);
    try {
      const raw = await schedulingService.getWeek(storeId, {
        week_start: shiftIsoDate(week.start, -7),
        mode: "planned",
      });
      const previous = adaptScheduleWeek(raw);

      if (previous.shifts.length === 0) {
        toast.warning("The previous week has no shifts to copy.");
        return;
      }

      /**
       * Someone scheduled last week may have left, or moved store, since. Their
       * shifts cannot be created here, so drop them and say who rather than
       * letting the whole save fail on EMPLOYEE_NOT_IN_STORE.
       */
      const currentIds = new Set(employees.map((e) => e.id));
      const kept = previous.shifts.filter((sh) => currentIds.has(sh.employeeId));
      const droppedNames = Array.from(
        new Set(
          previous.shifts
            .filter((sh) => !currentIds.has(sh.employeeId))
            .map(
              (sh) =>
                previous.employees.find((e) => e.id === sh.employeeId)?.name ??
                "an employee no longer here"
            )
        )
      );

      if (kept.length === 0) {
        toast.warning(
          "None of last week's staff are on this week's roster, so there is nothing to copy."
        );
        return;
      }

      replaceDraftWeek(
        storeId,
        week.start,
        kept.map((sh) => ({
          employeeId: sh.employeeId,
          dayIndex: sh.dayIndex,
          startTime: sh.startTime,
          endTime: sh.endTime,
          label: sh.label,
          type: sh.type,
          note: sh.note,
        })),
        // The drafts ARE the week, so saving replaces what is there.
        "replace"
      );

      toast.success(
        `Copied ${kept.length} shift${kept.length !== 1 ? "s" : ""} — review, then press Save.`
      );
      if (droppedNames.length > 0) {
        toast.warning(
          `Skipped shifts for ${droppedNames.join(", ")} — not on this week's roster.`
        );
      }
    } catch (err) {
      const parsed = parseSchedulingError(
        err,
        "Could not load the previous week."
      );
      if (handleUnauthorized(parsed.status)) return;
      toast.error(parsed.message);
    } finally {
      setIsCopyingWeek(false);
    }
  }, [storeId, week.start, employees, replaceDraftWeek]);

  /**
   * Save the current week as a reusable template.
   *
   * Only the NAME and the WEEK go to the server — it snapshots the week itself.
   * The client used to build the shift list, which described what the browser
   * had rendered rather than what was actually saved.
   */
  const handleSaveTemplate = useCallback(() => {
    // The server snapshots the week from its OWN data, so drafts are invisible
    // to it — saving now would produce a template missing the shifts on screen.
    if (hasDrafts) {
      toast.warning("Save your unsaved shifts first — a template can't include them.");
      return;
    }
    if (!templateName.trim()) {
      toast.warning("Please enter a template name");
      return;
    }
    if (shifts.length === 0) {
      toast.warning("No shifts to save as a template");
      return;
    }
    void templates
      .saveTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        weekStart: week.start,
      })
      .then((ok) => {
        if (!ok) return;
        setSaveTemplateOpen(false);
        setTemplateName("");
        setTemplateDescription("");
        toast.success(`Template "${templateName.trim()}" saved`);
      });
  }, [templateName, templateDescription, shifts.length, week.start, templates, hasDrafts]);

  /**
   * Apply a template to the displayed week.
   *
   * This fans out into one Humanity write per shift, so it runs as an async
   * batch rather than a single request. `replace` matches what "Load Week
   * Template" has always implied, and it sequences deletes before creates so a
   * mid-run failure is visible instead of silently doubling the week.
   */
  const handleLoadTemplate = useCallback(
    (template: ScheduleTemplate) => {
      setLoadTemplateOpen(false);
      void bulk.run(
        () =>
          schedulingService.applyTemplate(storeId!, {
            template_id: template.id,
            week_start: week.start,
            mode: "replace",
          }),
        { fallbackMessage: `Could not apply "${template.name}".` }
      );
    },
    [bulk, storeId, week.start]
  );

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      void templates.deleteTemplate(templateId).then((ok) => {
        if (ok) toast.info("Template deleted");
      });
    },
    [templates]
  );

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

      for (const emp of employees) {
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
   * Uses the EMPLOYEE view — no hours, totals or time off — because that is what
   * actually gets posted in store, and it must not leak pay-adjacent detail to
   * everyone who walks past the noticeboard.
   *
   * `canvas.toBlob`, never `toDataURL`: the upload is multipart, and a data URL
   * would put 1-3 MB of base64 inside a JSON body. The download-a-PNG handlers
   * elsewhere still use `toDataURL`, which is correct for an <a download>.
   */
  const handlePublishWeek = useCallback(async () => {
    setIsEmployeeScreenshot(true);
    // Let React paint the employee-view grid before capturing it.
    await new Promise((r) => setTimeout(r, 100));

    let blob: Blob | null = null;
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const target = gridRef.current;
      if (target) {
        const canvas = await html2canvas(target, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
      }
    } catch {
      // The screenshot is optional upstream — publishing the week still matters
      // more than the image, so carry on without it rather than blocking.
      blob = null;
    } finally {
      setIsEmployeeScreenshot(false);
    }

    if (!blob) {
      toast.warning("Publishing without a preview image — the grid couldn't be captured.");
    }

    await published.publish(week.start, blob);
  }, [week.start, published]);

  const handleDeletePublished = useCallback(
    (id: string) => {
      void published.remove(id);
    },
    [published]
  );

  /**
   * Clear every shift in the displayed week.
   *
   * `confirm: true` is mandatory upstream — this deletes real shifts employees
   * may already be working from. Runs as a batch and there is no undo.
   */
  const handleConfirmClearWeek = useCallback(() => {
    setClearConfirmOpen(false);
    void bulk.run(() => schedulingService.clearWeek(storeId!, week.start), {
      fallbackMessage: "Could not clear this week.",
    });
  }, [bulk, storeId, week.start]);

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

  const pageHeader = (
    <PageHeader
      title="Employee Schedule"
      description="Manage weekly shifts for your team"
    />
  );

  if (!selectedStore) {
    return (
      <div className="space-y-6">
        {pageHeader}
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

  const activeSetupError = setupError ?? writeSetupError;

  if (activeSetupError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <ScheduleSetupError
          code={activeSetupError.code}
          message={activeSetupError.message}
          storeLabel={selectedStore?.name ?? selectedStore?.storeId ?? null}
        />
      </div>
    );
  }

  // First load for this store/week — nothing to keep on screen yet.
  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        {pageHeader}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-45 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-125 rounded-lg" />
      </div>
    );
  }

  /**
   * A hard load failure with nothing cached. The server's own message is the
   * headline — a bare status code tells a manager nothing actionable.
   */
  if (weekError && !data) {
    return (
      <div className="space-y-4">
        {pageHeader}
        <ScheduleErrorAlert
          error={weekError}
          title="Couldn't load this week's schedule"
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Page header */}
        {pageHeader}

        {/*
          A bulk operation that never started. `operation` stays null in that
          case, so the progress dialog cannot report it — without this the
          manager confirms an action and sees nothing happen at all.
        */}
        {bulk.error && !bulk.operation && (
          <ScheduleErrorAlert
            error={bulk.error}
            title="Couldn't start that operation"
            onDismiss={bulk.dismiss}
            compact
          />
        )}

        {/* A refetch failed but we still have a usable week on screen. */}
        {weekError && data && (
          <ScheduleErrorAlert
            error={weekError}
            title="Couldn't refresh this week"
            onRetry={refetch}
            compact
          />
        )}

        {/* Toolbar: week nav + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Week navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                  guard.requestAction(() =>
                    setWeekStart((w) => shiftIsoDate(w, -7))
                  )
                }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              {isRefetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Calendar className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium whitespace-nowrap">
                {week.label}
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                  guard.requestAction(() =>
                    setWeekStart((w) => shiftIsoDate(w, 7))
                  )
                }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {week.start !== snapToWeekStart(todayIso(), week.weekStartDow) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={() => guard.requestAction(handleGoToToday)}
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
                onClick={() =>
                  requestModeChange(true, () => setScheduleMode("planned"))
                }
                disabled={comparisonMode}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Planned
              </Button>
              <Button
                variant={scheduleMode === "actual" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 text-xs px-2.5"
                onClick={() =>
                  requestModeChange(false, () => setScheduleMode("actual"))
                }
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
                  onClick={() =>
                      requestModeChange(
                        comparisonMode && scheduleMode === "planned",
                        () => setComparisonMode((c) => !c)
                      )
                    }
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
          <div className="flex flex-wrap items-center gap-2">
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
                  disabled={comparisonMode}
                  onClick={() => setAvailabilityOpen(true)}
                >
                  <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
                  Availability
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {comparisonMode
                  ? "Not available while comparing — switch to Planned or Actual"
                  : "Manage blocked times and time off for this week"}
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
                {departmentOptions.map((dept) => (
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
                {comparisonMode && (
                  <>
                    <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                      Compare is a read-only view. Switch to Planned or Actual
                      to make changes.
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel className="text-xs text-muted-foreground">Schedule</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isCopyingWeek || comparisonMode}
                  onSelect={() => setCopyConfirmOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-blue-600" />
                  Copy Previous Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={shifts.length === 0 || comparisonMode}
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
                  disabled={
                    published.isPublishing || shifts.length === 0 || comparisonMode
                  }
                  onSelect={handlePublishWeek}
                  className="gap-2 cursor-pointer"
                >
                  {published.isPublishing ? (
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
                  disabled={shifts.length === 0 || comparisonMode}
                  onSelect={() => setSaveTemplateOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <BookmarkPlus className="h-4 w-4 text-violet-500" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={templates.templates.length === 0 || comparisonMode}
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
                  disabled={isExporting || comparisonMode}
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
            <CardContent className="flex items-center gap-2 sm:gap-3 py-2.5 px-3 sm:py-3 sm:px-4">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
                  Total Hours
                </p>
                <p className="text-base sm:text-lg font-bold leading-tight">
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-2 sm:gap-3 py-2.5 px-3 sm:py-3 sm:px-4">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
                  Shifts
                </p>
                <p className="text-base sm:text-lg font-bold leading-tight">
                  {stats.totalShifts}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-2 sm:gap-3 py-2.5 px-3 sm:py-3 sm:px-4">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
                  Active Staff
                </p>
                <p className="text-base sm:text-lg font-bold leading-tight">
                  {stats.activeEmployees}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-0">
            <CardContent className="flex items-center gap-2 sm:gap-3 py-2.5 px-3 sm:py-3 sm:px-4">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">$</span>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-medium leading-tight text-muted-foreground uppercase tracking-wider">
                  Est. Labor (current rates)
                </p>
                <p className="text-base sm:text-lg font-bold leading-tight">
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

        {/*
          Save / Cancel for unsaved shifts. Deliberately outside `gridRef`: the
          screenshot and publish handlers capture that element, and this bar has
          no business appearing in the PNG that goes up in the store.
        */}
        {/*
          Planned mode only. Drafts are unsaved additions to the PLAN, so a Save
          button in Actual or Compare would act on shifts that view does not
          render — which is exactly what it used to do.
        */}
        {isPlannedOnly && (
          <DraftActionBar
            count={drafts.length}
            saveMode={draftSaveMode}
            isSaving={bulk.isStarting}
            onSave={handleSaveDrafts}
            onCancel={() => setCancelDraftsOpen(true)}
          />
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
            draftShifts={drafts}
            onEditDraft={handleEditDraft}
            onDeleteDraft={handleDeleteDraft}
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
              onClick={() => setClearConfirmOpen(true)}
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
              mutations.cancelSyncWait();
              mutations.clearError();
              setPendingAdd(null);
              setEditingShift(null);
              setEditingDraft(null);
            }
          }}
          employee={targetEmployee}
          dayLabel={
            week.dayNames[
              editingDraft?.dayIndex ??
                editingShift?.dayIndex ??
                pendingAdd?.dayIndex ??
                0
            ] ?? ""
          }
          dayIndex={
            editingDraft?.dayIndex ??
            editingShift?.dayIndex ??
            pendingAdd?.dayIndex ??
            0
          }
          currentShifts={shifts}
          availability={availability}
          timeOff={timeOff}
          onConfirm={handleConfirmShift}
          editingShift={editingShift}
          editingDraft={editingDraft}
          isSubmitting={mutations.isSubmitting}
          syncWait={mutations.syncWait}
          onCancelSyncWait={() => {
            mutations.cancelSyncWait();
            setShiftDialogOpen(false);
            setPendingAdd(null);
            setEditingShift(null);
          }}
          onRequestManualSync={() => void mutations.requestManualSync()}
          onRetryAfterSync={mutations.retryPending}
          isRequestingSync={mutations.isRequestingSync}
          error={mutations.error}
        />

        {/* Warns before week / mode changes and before leaving the page */}
        <UnsavedShiftsDialog {...guard.dialogProps} />

        {/* Cancel drafts — this one genuinely discards, so it says so */}
        <AlertDialog open={cancelDraftsOpen} onOpenChange={setCancelDraftsOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Discard {drafts.length} unsaved shift
                {drafts.length !== 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This removes the shifts you have laid out but not saved, and
                reloads the week as it is actually scheduled. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelDrafts}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Availability & time off */}
        <AvailabilityTimeOffDialog
          open={availabilityOpen}
          onOpenChange={setAvailabilityOpen}
          week={week}
          employees={employees}
          availability={availability}
          timeOff={timeOff}
          onAddAvailability={handleAddAvailability}
          onDeleteAvailability={handleDeleteAvailability}
          onAddTimeOff={handleAddTimeOff}
          onDeleteTimeOff={handleDeleteTimeOff}
        />

        {/* Published history */}
        <Dialog open={publishedOpen} onOpenChange={setPublishedOpen}>
          {/*
            Single scroller, same fix as the availability dialog: the content
            box no longer scrolls as a whole while an inner div also scrolls,
            which chained the wheel between the two and pushed the footer away.
          */}
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Published schedules</DialogTitle>
              <DialogDescription>
                Weeks that have been published for staff. Re-publishing a week
                supersedes its previous record.
              </DialogDescription>
            </DialogHeader>
            {published.error && (
              <ScheduleErrorAlert
                error={published.error}
                title="Publishing problem"
                onDismiss={published.clearError}
                compact
              />
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-1">
              <PublishedSchedules
                schedules={published.schedules}
                onDelete={handleDeletePublished}
                readOnly={comparisonMode}
              />
            </div>
            <DialogFooter className="mt-3 border-t pt-3">
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
          code={mutations.warning?.code ?? null}
          message={mutations.warning?.message}
          detail={mutations.warning?.detail}
          onConfirm={mutations.confirmWarning}
          onCancel={mutations.cancelWarning}
          isSubmitting={mutations.isSubmitting}
        />

        {/* Async bulk operation progress */}
        <BulkOperationProgress
          operation={bulk.operation}
          onRetryFailed={() => void bulk.retryFailed()}
          onClose={bulk.dismiss}
          isRetrying={bulk.isRetrying}
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
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Load Week Template</DialogTitle>
              <DialogDescription>
                Choose a saved template to load into <strong>{week.label}</strong>.
                This will replace all current shifts.
              </DialogDescription>
            </DialogHeader>
            {templates.templates.length === 0 ? (
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
                  {templates.templates.map((tmpl) => (
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
                            {formatTimestamp(tmpl.createdAt, "MMM d, yyyy")}
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
