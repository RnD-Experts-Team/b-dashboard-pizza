"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Camera,
  CalendarDays,
  Database,
  ExternalLink,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Undo2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CreateEmployeeDebriefForm } from "@/components/employee-debriefs/create-employee-debrief-form";
import { DueKeyValueSheet } from "@/components/due-keys/due-key-value-sheet";
import { FillAllKeysSheet } from "@/components/due-keys/fill-all-keys-sheet";
import { CompleteTaskForm, StatusPill, formatDate } from "@/components/cleaning";
import { useCreateEmployeeDebrief } from "@/lib/hooks/use-employee-debriefs";
import { useDueKeys, useSetDueKeyValue, useSetDueKeysBulk } from "@/lib/hooks/use-due-keys";
import { todayIso } from "@/lib/hooks/use-cleaning";
import { useCleaningStore } from "@/lib/store/cleaning.store";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { canAccessCleaningTab } from "@/lib/auth/cleaning-access";
import { playSfx } from "@/lib/uisfx/play";
import { cn } from "@/lib/utils";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";
import type { DueItem } from "@/types/cleaning.types";

interface StoreOption {
  id: string;
  name: string;
}

function formatTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseAuthUserStores(): StoreOption[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("auth-user");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      stores?: Array<{
        store?: {
          id?: string | number;
          store_id?: string | number;
          name?: string;
        };
      }>;
    };

    return (parsed.stores ?? [])
      .map((entry) => {
        const store = entry.store;
        const resolvedId = String(store?.store_id ?? store?.id ?? "").trim();
        const resolvedName = store?.name?.trim() || resolvedId;
        return { id: resolvedId, name: resolvedName };
      })
      .filter((s) => s.id.length > 0);
  } catch {
    return [];
  }
}

function renderValuePreview(item: DueKeyItem): string {
  const v = item.value;
  if (v == null) return "—";
  if (v.valueText != null) return String(v.valueText);
  if (v.valueNumber != null) return String(v.valueNumber);
  if (v.valueBoolean != null) return v.valueBoolean ? "Yes" : "No";
  if (v.valueJson != null) {
    try { return JSON.stringify(v.valueJson); } catch { return "[JSON]"; }
  }
  return "—";
}

// Layout constants — keep in sync with the button / panel sizes
const FAB_W = 108;   // approximate FAB button width in px
const FAB_H = 44;    // FAB button height in px
const PANEL_W = 480; // floating panel width (w-120 = 30 rem)
const EDGE = 8;      // minimum gap from each screen edge

export function FloatingDebriefButton() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [activeNav, setActiveNav] = useState<"debrief" | "due-keys" | "cleaning-chart">(
    "debrief"
  );
  const [isMobile, setIsMobile] = useState(false);

  // ── Cleaning Chart state ───────────────────────────────────────────────
  const t = useTranslations("cleaningChart");
  const [cleaningDate, setCleaningDate] = useState<string>(todayIso());
  const [cleaningCompleteItem, setCleaningCompleteItem] = useState<DueItem | null>(null);
  const [cleaningUndoTarget, setCleaningUndoTarget] = useState<DueItem | null>(null);
  const [cleaningUndoing, setCleaningUndoing] = useState<number | null>(null);

  // ── Due Keys state ─────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(formatTodayDate());
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [dueKeySheetOpen, setDueKeySheetOpen] = useState(false);
  const [dueKeySheetItem, setDueKeySheetItem] = useState<DueKeyItem | null>(null);
  const [fillAllSheetOpen, setFillAllSheetOpen] = useState(false);
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null);

  const hasDragged = useRef(false);
  const dragOrigin = useRef<{ px: number; py: number; ex: number; ey: number } | null>(null);

  const { canAccessRoute, hasAnyRole, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const pendingDebriefKey = useDebriefActionStore((s) => s.pendingDebriefKey);
  const clearPendingDebriefKey = useDebriefActionStore((s) => s.clearPendingDebriefKey);
  const pendingPanelTab = useDebriefActionStore((s) => s.pendingPanelTab);
  const clearPendingPanelTab = useDebriefActionStore((s) => s.clearPendingPanelTab);
  const setTaskCounts = useDebriefActionStore((s) => s.setTaskCounts);

  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canCreateDebrief = canAccessRoute({
    service: "Data",
    method: "POST",
    path: "/engine/stores/debrief",
    storeId: effectiveStoreId,
  });
  const canSeeCleaningChart = canAccessCleaningTab(
    "due",
    { canAccessRoute, hasAnyRole },
    effectiveStoreId
  );

  // ── Cleaning Chart hooks ───────────────────────────────────────────────
  const { dueData, dueLoading, dueError, fetchDue, completeTask, uncompleteTask } =
    useCleaningStore();
  const cleaningStore = useMemo(() => {
    const match = overviewStores?.find(
      (o) => String(o.id) === selectedStoreId || o.storeId === selectedStoreId
    );
    return match ? { id: Number(match.id), code: match.storeId ?? String(match.id) } : null;
  }, [overviewStores, selectedStoreId]);

  const {
    createDebrief,
    isSubmitting,
    error: createError,
    clearError: clearCreateError,
  } = useCreateEmployeeDebrief();

  // ── Due Keys hooks ─────────────────────────────────────────────────────
  const {
    data: dueKeysData,
    isLoading: isDueKeysLoading,
    isRefreshing: isDueKeysRefreshing,
    refetch: refetchDueKeys,
  } = useDueKeys(
    selectedStoreId,
    selectedDate,
    selectedTagIds.length > 0 ? selectedTagIds : undefined
  );

  const {
    setDueKeyValue,
    isSubmitting: isDueKeySubmitting,
    error: dueKeySubmitError,
    clearError: clearDueKeyError,
  } = useSetDueKeyValue();

  const {
    setDueKeysBulk,
    isSubmitting: isBulkSubmitting,
    error: bulkSubmitError,
  } = useSetDueKeysBulk();

  const selectedStoreName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? null,
    [stores, selectedStoreId]
  );

  const cleaningItems = useMemo(() => dueData?.items ?? [], [dueData]);
  const cleaningPendingCount = useMemo(
    () => cleaningItems.filter((i) => i.status !== "done").length,
    [cleaningItems]
  );

  const activeItems = useMemo(() => dueKeysData?.items ?? [], [dueKeysData]);
  const unfilledItems = useMemo(() => activeItems.filter((i) => !i.filled), [activeItems]);
  const availableTags = useMemo(() => {
    const uniqueTags = new Map<number, { id: number; name: string }>();

    for (const item of activeItems) {
      for (const tag of item.tags ?? []) {
        if (!uniqueTags.has(tag.id)) {
          uniqueTags.set(tag.id, { id: tag.id, name: tag.name });
        }
      }
    }

    return Array.from(uniqueTags.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeItems]);

  useEffect(() => {
    const parsed = parseAuthUserStores();
    setStores(parsed);
    if (parsed.length > 0 && !selectedStoreId) {
      setSelectedStoreId(parsed[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the panel's selected store in sync with the sidebar's selection.
  // A manual pick inside the panel's own dropdown is still allowed, but the
  // next time the sidebar store changes, it takes priority again.
  useEffect(() => {
    const sidebarStoreId = selectedStore?.storeId ?? selectedStore?.id ?? null;
    if (sidebarStoreId) setSelectedStoreId(sidebarStoreId);
  }, [selectedStore]);

  // Detect mobile and initialise FAB position
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    setPos({
      x: window.innerWidth - FAB_W - EDGE,
      y: window.innerHeight - FAB_H - EDGE,
    });
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Effect A: wire up store+date when a debrief notification is clicked ──
  useEffect(() => {
    if (!pendingDebriefKey) return;
    setSelectedStoreId(pendingDebriefKey.storeId);
    setSelectedDate(pendingDebriefKey.date);
    setPendingKeyId(pendingDebriefKey.keyId);
    clearPendingDebriefKey();
  }, [pendingDebriefKey, clearPendingDebriefKey]);

  // ── Effect B: once due-keys data loads, auto-open the sheet for the target key
  useEffect(() => {
    if (pendingKeyId === null || isDueKeysLoading) return;
    const item = dueKeysData?.items.find((i) => i.keyId === pendingKeyId);
    setPendingKeyId(null);
    if (item) {
      handleDueKeyRowClick(item);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueKeysData, pendingKeyId, isDueKeysLoading]);

  // ── Effect C: fetch due cleaning tasks for the panel's selected store+date ──
  useEffect(() => {
    if (cleaningStore) fetchDue(cleaningStore.id, cleaningDate);
  }, [cleaningStore, cleaningDate, fetchDue]);

  // Clamp FAB position when the viewport is resized
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        return {
          x: Math.max(EDGE, Math.min(window.innerWidth - FAB_W - EDGE, prev.x)),
          y: Math.max(EDGE, Math.min(window.innerHeight - FAB_H - EDGE, prev.y)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Effect D: publish due-key counts for other surfaces (Manager Tasks card)
  // Runs above the early-returns below so the counts stay published even when
  // this panel itself is hidden.
  useEffect(() => {
    setTaskCounts({
      dueKeysUnfilled: unfilledItems.length,
      dueKeysTotal: activeItems.length,
      dueKeysUnfilledLabels: unfilledItems.map((i) => i.label),
      dueKeysDate: selectedDate,
      dueKeysReady: !isDueKeysLoading && dueKeysData != null,
    });
  }, [unfilledItems, activeItems, selectedDate, isDueKeysLoading, dueKeysData, setTaskCounts]);

  // ── Effect E: publish cleaning-task counts + panel availability ──────────
  useEffect(() => {
    setTaskCounts({
      cleaningPending: cleaningPendingCount,
      cleaningTotal: cleaningItems.length,
      cleaningPendingLabels: cleaningItems
        .filter((i) => i.status !== "done")
        .map((i) => i.label),
      cleaningDate: cleaningDate,
      cleaningReady: !dueLoading && dueData != null,
      canSeeCleaning: canSeeCleaningChart,
      panelAvailable: canCreateDebrief && !pathname?.includes("/due-keys"),
    });
  }, [
    cleaningPendingCount,
    cleaningItems,
    cleaningDate,
    dueLoading,
    dueData,
    canSeeCleaningChart,
    canCreateDebrief,
    pathname,
    setTaskCounts,
  ]);

  // ── Effect F: open the panel on a requested tab (Manager Tasks card rows) ─
  useEffect(() => {
    if (!pendingPanelTab) return;
    setActiveNav(pendingPanelTab);
    setIsOpen(true);
    clearPendingPanelTab();
  }, [pendingPanelTab, clearPendingPanelTab]);

  if (!canCreateDebrief) return null;
  if (pathname?.includes("/due-keys")) return null;

  // ── Drag handlers — free 2-D drag with viewport clamping ─────────────
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pos) return;
    hasDragged.current = false;
    dragOrigin.current = { px: e.clientX, py: e.clientY, ex: pos.x, ey: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.px;
    const dy = e.clientY - dragOrigin.current.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged.current = true;
    if (!hasDragged.current) return;
    setPos({
      x: Math.max(EDGE, Math.min(window.innerWidth - FAB_W - EDGE, dragOrigin.current.ex + dx)),
      y: Math.max(EDGE, Math.min(window.innerHeight - FAB_H - EDGE, dragOrigin.current.ey + dy)),
    });
  }

  function handlePointerUp(_e: React.PointerEvent<HTMLDivElement>) {
    dragOrigin.current = null;
  }

  function handleClick() {
    if (hasDragged.current) {
      hasDragged.current = false;
      return;
    }
    setIsOpen((prev) => !prev);
  }

  const handleDueKeyRowClick = (item: DueKeyItem) => {
    setDueKeySheetItem(item);
    clearDueKeyError();
    setDueKeySheetOpen(true);
  };

  const handleSubmitDueKeyValue = async (
    payload: DueKeyValuePayload,
    mode: "created" | "updated" | "deactivated"
  ) => {
    if (!selectedStoreId) return null;
    const result = await setDueKeyValue(selectedStoreId, selectedDate, payload);
    if (!result) {
      if (dueKeySubmitError) toast.error(dueKeySubmitError);
      return null;
    }
    const corrected =
      result.correctedFromId != null || (result.mistakenVersions?.length ?? 0) > 0;
    if (mode === "created") toast.success("Key value created.");
    else if (mode === "deactivated") toast.success("Key value deactivated.");
    else if (corrected) toast.success("Value corrected — previous value kept in history.");
    else toast.success("Key value updated.");
    // Keep the sheet open so the correction + history are shown; refresh the list in the background.
    refetchDueKeys();
    return result;
  };

  const handleBulkSubmit = async (payload: { items: DueKeyValuePayload[] }): Promise<boolean> => {
    if (!selectedStoreId) return false;
    const result = await setDueKeysBulk(selectedStoreId, selectedDate, payload.items);
    if (result) refetchDueKeys();
    return !!result;
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const confirmCleaningUndo = async () => {
    const item = cleaningUndoTarget;
    if (!item || !cleaningStore) return;
    setCleaningUndoing(item.taskId);
    try {
      await uncompleteTask(cleaningStore.id, item.taskId, cleaningDate);
      toast.success(t("due.toasts.reverted", { label: item.label }));
      setCleaningUndoTarget(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("due.toasts.undoFailed"));
    } finally {
      setCleaningUndoing(null);
    }
  };

  // Compute floating panel screen position for desktop only
  function getPanelStyle() {
    if (!pos) return {};
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const leftOfFab = pos.x - EDGE - PANEL_W;
    const rightOfFab = pos.x + FAB_W + EDGE;
    const left =
      leftOfFab >= EDGE
        ? leftOfFab
        : Math.max(EDGE, Math.min(vw - PANEL_W - EDGE, rightOfFab));
    const maxH = vh * 0.8;
    const top = Math.max(EDGE, Math.min(vh - maxH - EDGE, pos.y));
    return { left, top };
  }

  // ── Panel inner content — shared between mobile and desktop ───────────
  const panelContent = (
    <>
      {/* Panel header */}
      <div className="shrink-0 bg-background px-4 pt-4 pb-3 border-b border-gray-100/60 dark:border-gray-800/60 rounded-t-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Store Notes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Employee Debrief notes &amp; Debrief values</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={selectedStoreId ?? ""}
              onValueChange={(v) => setSelectedStoreId(v || null)}
              disabled={stores.length === 0}
            >
              <SelectTrigger className="h-7 text-xs w-auto max-w-36 sm:max-w-40 rounded-full bg-muted/60 hover:bg-muted border-0 px-3 shadow-none font-medium gap-1.5 focus:ring-0 focus:ring-offset-0">
                <SelectValue
                  placeholder={stores.length === 0 ? "No stores" : "Select store"}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                style={{ maxHeight: "160px", overflowY: "auto" }}
                className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              >
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-gray-100/40 dark:border-gray-800/40">
        <button
          type="button"
          onClick={() => setActiveNav("debrief")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            activeNav === "debrief"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <PenLine className="h-3.5 w-3.5" />
          Employee Debrief
        </button>
        <button
          type="button"
          onClick={() => setActiveNav("due-keys")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            activeNav === "due-keys"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Database className="h-3.5 w-3.5" />
          Debrief
          {unfilledItems.length > 0 && (
            <span className="ml-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              {unfilledItems.length}
            </span>
          )}
        </button>
        {canSeeCleaningChart && (
          <button
            type="button"
            onClick={() => setActiveNav("cleaning-chart")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
              activeNav === "cleaning-chart"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("page.title")}
            {cleaningPendingCount > 0 && (
              <span className="ml-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                {cleaningPendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {/* ── Debrief Section ─────────────────────────────────────── */}
        {activeNav === "debrief" && (
        <div className="py-4">
          <div className="flex items-center gap-2 mb-3 px-4">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Employee Debrief
              {selectedStoreName && (
                <span className="normal-case tracking-normal font-normal text-muted-foreground ml-1">({selectedStoreName})</span>
              )}
            </h4>
          </div>
          <div className="px-4">
          <CreateEmployeeDebriefForm
            storeId={selectedStoreId}
            isSubmitting={isSubmitting}
            submitError={createError}
            onClearError={clearCreateError}
            employees={dueKeysData?.employees ?? []}
            debriefTypes={dueKeysData?.employeeDebriefTypes ?? []}
            onSubmit={async (payload) => {
              if (!selectedStoreId) return false;
              const result = await createDebrief(selectedStoreId, payload);
              if (result) {
                toast.success("Debrief submitted successfully.");
                playSfx("success");
              }
              return !!result;
            }}
          />
          </div>
        </div>
        )}

        {/* ── Due Keys Section ─────────────────────────────────────── */}
        {activeNav === "due-keys" && (
        <div className="py-4">
          <div className="flex items-center gap-2 mb-3 px-4">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Debrief
              {selectedStoreName && (
                <span className="normal-case tracking-normal font-normal text-muted-foreground ml-1">({selectedStoreName})</span>
              )}
            </h4>
          </div>

          {/* Date picker */}
          <div className="px-4 pb-3 border-b border-gray-100/40 dark:border-gray-800/40">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Date</Label>
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 text-xs border-gray-200/60 dark:border-gray-700/60"
            />
          </div>

          {/* Tag filter pills */}
          {(availableTags.length > 0 || selectedTagIds.length > 0) && (
            <div className="px-4 py-2.5 border-b border-gray-100/40 dark:border-gray-800/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Filter by Tag
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedTagIds([])}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors border",
                    selectedTagIds.length === 0
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-gray-200/80 dark:border-gray-700/80 hover:border-gray-400 dark:hover:border-gray-500"
                  )}
                >
                  All
                </button>
                {availableTags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors border",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-gray-200/80 dark:border-gray-700/80 hover:border-gray-400 dark:hover:border-gray-500"
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-header: stats + Fill All Keys */}
          <div className="px-4 py-2 border-b border-gray-100/40 dark:border-gray-800/40 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isDueKeysLoading || isDueKeysRefreshing ? (
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{unfilledItems.length}</span>
                  {" unfilled · "}
                  <span className="font-semibold text-foreground">{activeItems.length}</span>
                  {" total"}
                </>
              )}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setFillAllSheetOpen(true)}
              disabled={!selectedStoreId || isDueKeysLoading || unfilledItems.length === 0}
            >
              Fill All Keys
            </Button>
          </div>

          {/* Key list */}
          <div>
            {isDueKeysLoading && !dueKeysData ? (
              <div className="px-4 py-3 space-y-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : !selectedStoreId ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                Select a store to load debrief data.
              </div>
            ) : activeItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No debrief items for this date.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {activeItems.map((item) => (
                  <button
                    key={item.keyId}
                    type="button"
                    onClick={() => handleDueKeyRowClick(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="flex-1 min-w-0 text-xs font-medium truncate text-foreground">
                      {item.label}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono bg-muted rounded px-1.5 py-0.5">
                      {item.dataType}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 text-[10px] h-5 px-1.5 border-0",
                        item.filled
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/15"
                      )}
                    >
                      {item.filled ? "Filled" : "Unfilled"}
                    </Badge>
                    {item.filled && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground max-w-24 truncate">
                        {item.value?.correctedFromId != null && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                            title="This value was corrected"
                          />
                        )}
                        <span className="truncate">{renderValuePreview(item)}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* ── Cleaning Chart Section ───────────────────────────────── */}
        {activeNav === "cleaning-chart" && (
        <div className="py-4">
          <div className="flex items-center gap-2 mb-3 px-4">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {t("page.title")}
              {selectedStoreName && (
                <span className="normal-case tracking-normal font-normal text-muted-foreground ml-1">({selectedStoreName})</span>
              )}
            </h4>
          </div>

          {cleaningCompleteItem && cleaningStore ? (
            /* ── Complete task — inline, same panel, no separate modal ── */
            <div className="px-4">
              <p className="mb-3 truncate text-sm font-medium text-foreground">
                {t("completeDialog.title", { label: cleaningCompleteItem.label })}
              </p>
              <CompleteTaskForm
                storeCode={cleaningStore.code}
                date={cleaningDate}
                item={cleaningCompleteItem}
                onComplete={(payload) =>
                  completeTask(cleaningStore.id, cleaningCompleteItem.taskId, payload)
                }
                onClose={() => setCleaningCompleteItem(null)}
              />
            </div>
          ) : (
          <>
          {/* Date picker */}
          <div className="px-4 pb-3 border-b border-gray-100/40 dark:border-gray-800/40">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {t("common.date")}
              </Label>
            </div>
            <Input
              type="date"
              value={cleaningDate}
              onChange={(e) => setCleaningDate(e.target.value)}
              className="h-8 text-xs border-gray-200/60 dark:border-gray-700/60"
            />
          </div>

          {/* Sub-header: stats + Refresh + Open in Cleaning Chart */}
          <div className="px-4 py-2 border-b border-gray-100/40 dark:border-gray-800/40 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {dueLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {t("common.loading")}
                </span>
              ) : (
                t("page.pendingTotal", {
                  pending: cleaningPendingCount,
                  total: cleaningItems.length,
                })
              )}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => cleaningStore && fetchDue(cleaningStore.id, cleaningDate)}
                disabled={!cleaningStore || dueLoading}
                title={t("common.refresh")}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", dueLoading && "animate-spin")} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => router.push(`/${locale}/dashboard/cleaning-chart`)}
              >
                {t("page.openFull")}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Due tasks list */}
          <div>
            {!cleaningStore ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("page.noStoreDescription")}
              </div>
            ) : dueLoading && !dueData ? (
              <div className="px-4 py-3 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 flex-1 max-w-40" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
            ) : dueError && !dueData ? (
              <div className="px-4 py-8 text-center text-xs text-destructive">
                {dueError.message}
              </div>
            ) : cleaningItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("due.table.empty", { date: cleaningDate })}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {cleaningItems.map((item) => (
                  <div
                    key={item.taskId}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        {item.hasPhoto && (
                          <Camera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {t(`frequency.${item.frequency}`)} · {item.period[0]} → {item.period[1]}
                      </p>
                      {item.doneBy.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate text-foreground">
                            {item.doneBy.join(", ")}
                          </span>
                          {item.doneAt && (
                            <span className="shrink-0">
                              · {t("historyDrawer.completedAt", { date: formatDate(item.doneAt) })}
                            </span>
                          )}
                        </p>
                      )}
                      {item.note && (
                        <p className="mt-1 truncate text-[11px] italic text-muted-foreground">
                          “{item.note}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill status={item.status} />
                      {item.status === "done" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setCleaningUndoTarget(item)}
                          disabled={cleaningUndoing === item.taskId}
                        >
                          <Undo2 className="me-1 h-3 w-3" />
                          {t("due.undo")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCleaningCompleteItem(item)}
                        >
                          {t("due.complete")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop — closes the panel on click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile panel — full-width bottom sheet ────────────────── */}
      {isOpen && isMobile && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex flex-col",
            "max-h-[88vh] rounded-t-2xl",
            "bg-background shadow-2xl",
            "border-t border-x border-gray-200/60 dark:border-gray-700/60",
          )}
        >
          {/* Drag handle */}
          <div className="shrink-0 flex justify-center pt-2 pb-0">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {panelContent}
        </div>
      )}

      {/* ── Desktop panel — free-floating ─────────────────────────── */}
      {isOpen && !isMobile && pos && (
        <div
          className={cn(
            "fixed z-50 w-120 max-h-[80vh]",
            "flex flex-col",
            "rounded-2xl bg-background shadow-2xl",
            "border border-gray-200/60 dark:border-gray-700/60",
          )}
          style={getPanelStyle()}
        >
          {panelContent}
        </div>
      )}

      {/* FAB button — freely draggable anywhere on screen */}
      {pos && (
        <div
          className="fixed z-50"
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        >
          <Button
            className={cn(
              "gap-2 rounded-full",
              "h-11 px-4 sm:px-5 text-sm font-medium shadow-lg",
              "transition-all duration-300 ease-in-out",
              "cursor-grab active:cursor-grabbing select-none touch-none",
              "border",
              isOpen
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-700 dark:border-gray-300"
                : "bg-black text-white dark:bg-white dark:text-black border-gray-800 dark:border-gray-200",
            )}
            size="sm"
          >
            <PenLine className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Debrief</span>
          </Button>
          {!isOpen && unfilledItems.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none pointer-events-none">
              {unfilledItems.length}
            </span>
          )}
        </div>
      )}

      {/* Due Key single-item sheet */}
      {selectedStoreId && (
        <DueKeyValueSheet
          open={dueKeySheetOpen}
          onOpenChange={setDueKeySheetOpen}
          item={dueKeySheetItem}
          storeId={selectedStoreId}
          date={selectedDate}
          isSubmitting={isDueKeySubmitting}
          submitError={dueKeySubmitError}
          onSubmit={handleSubmitDueKeyValue}
        />
      )}

      {/* Fill All Keys bulk sheet */}
      {selectedStoreId && (
        <FillAllKeysSheet
          open={fillAllSheetOpen}
          onOpenChange={setFillAllSheetOpen}
          items={activeItems}
          storeId={selectedStoreId}
          date={selectedDate}
          isSubmitting={isBulkSubmitting}
          submitError={bulkSubmitError}
          onSubmit={handleBulkSubmit}
        />
      )}

      {/* Cleaning Chart: confirm undo */}
      <AlertDialog
        open={cleaningUndoTarget != null}
        onOpenChange={(o) => !o && setCleaningUndoTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("due.undoDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("due.undoDialog.description", {
                label: cleaningUndoTarget?.label ?? "",
                date: cleaningDate,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaningUndoing != null}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={cleaningUndoing != null}
              onClick={(e) => {
                e.preventDefault();
                void confirmCleaningUndo();
              }}
            >
              {cleaningUndoing != null && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {t("due.undo")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
