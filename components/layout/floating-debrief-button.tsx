"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, KeyRound, PenLine, RefreshCw, X } from "lucide-react";
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
import { CreateEmployeeDebriefForm } from "@/components/employee-debriefs/create-employee-debrief-form";
import { DueKeyValueSheet } from "@/components/due-keys/due-key-value-sheet";
import { FillAllKeysSheet } from "@/components/due-keys/fill-all-keys-sheet";
import { useCreateEmployeeDebrief } from "@/lib/hooks/use-employee-debriefs";
import { useDueKeys, useSetDueKeyValue, useSetDueKeysBulk } from "@/lib/hooks/use-due-keys";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { cn } from "@/lib/utils";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";

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
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [activeNav, setActiveNav] = useState<"debrief" | "due-keys">("debrief");
  const [isMobile, setIsMobile] = useState(false);

  // ── Due Keys state ─────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(formatTodayDate());
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [dueKeySheetOpen, setDueKeySheetOpen] = useState(false);
  const [dueKeySheetItem, setDueKeySheetItem] = useState<DueKeyItem | null>(null);
  const [fillAllSheetOpen, setFillAllSheetOpen] = useState(false);
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null);

  const hasDragged = useRef(false);
  const dragOrigin = useRef<{ px: number; py: number; ex: number; ey: number } | null>(null);

  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();
  const pendingDebriefKey = useDebriefActionStore((s) => s.pendingDebriefKey);
  const clearPendingDebriefKey = useDebriefActionStore((s) => s.clearPendingDebriefKey);

  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canCreateDebrief = canAccessRoute({
    service: "Data",
    method: "POST",
    path: "/engine/stores/debrief",
    storeId: effectiveStoreId,
  });

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
    if (parsed.length > 0) {
      setSelectedStoreId(parsed[0].id);
    }
  }, []);

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
          <KeyRound className="h-3.5 w-3.5" />
          Debrief
          {unfilledItems.length > 0 && (
            <span className="ml-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              {unfilledItems.length}
            </span>
          )}
        </button>
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
            onSubmit={async (payload) => {
              if (!selectedStoreId) return false;
              const result = await createDebrief(selectedStoreId, payload);
              if (result) {
                toast.success("Debrief submitted successfully.");
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
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
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
    </>
  );
}
