"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  if (v.valueBoolean != null) return String(v.valueBoolean);
  if (v.valueJson != null) {
    try { return JSON.stringify(v.valueJson); } catch { return "[JSON]"; }
  }
  return "—";
}

export function FloatingDebriefButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [activeNav, setActiveNav] = useState<"debrief" | "due-keys">("debrief");

  // ── Due Keys state ─────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(formatTodayDate());
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [dueKeySheetOpen, setDueKeySheetOpen] = useState(false);
  const [dueKeySheetItem, setDueKeySheetItem] = useState<DueKeyItem | null>(null);
  const [fillAllSheetOpen, setFillAllSheetOpen] = useState(false);

  const hasDragged = useRef(false);
  const dragStartY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debriefSectionRef = useRef<HTMLDivElement>(null);
  const dueKeysSectionRef = useRef<HTMLDivElement>(null);

  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

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

  if (!canCreateDebrief) return null;

  // ── Drag handlers — snap to top or bottom on release ──────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    hasDragged.current = false;
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (Math.abs(e.clientY - dragStartY.current) > 8) hasDragged.current = true;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!hasDragged.current) return;
    const delta = e.clientY - dragStartY.current;
    if (delta < -40) setPosition("top");
    else if (delta > 40) setPosition("bottom");
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
    if (!selectedStoreId) return;
    const success = await setDueKeyValue(selectedStoreId, selectedDate, payload);
    if (!success) {
      if (dueKeySubmitError) toast.error(dueKeySubmitError);
      return;
    }
    if (mode === "created") toast.success("Key value created.");
    else if (mode === "deactivated") toast.success("Key value deactivated.");
    else toast.success("Key value updated.");
    setDueKeySheetOpen(false);
    refetchDueKeys();
  };

  const handleBulkSubmit = async (payload: { items: DueKeyValuePayload[] }): Promise<boolean> => {
    if (!selectedStoreId) return false;
    const success = await setDueKeysBulk(selectedStoreId, selectedDate, payload.items);
    if (success) refetchDueKeys();
    return success;
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const scrollToSection = useCallback((section: "debrief" | "due-keys") => {
    const ref = section === "debrief" ? debriefSectionRef : dueKeysSectionRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNav(section);
  }, []);

  // Track which section is in view to highlight the active nav button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const handleScroll = () => {
      const containerTop = container.scrollTop;
      const dueKeysTop = dueKeysSectionRef.current?.offsetTop ?? Infinity;
      // offset by a small threshold so nav switches a bit before the section hits the very top
      setActiveNav(containerTop + 40 >= dueKeysTop ? "due-keys" : "debrief");
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

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

      {/* Floating panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 right-6 w-120 max-h-[80vh]",
            position === "bottom" ? "bottom-20" : "top-30",
            "flex flex-col",
            "rounded-2xl bg-background shadow-2xl",
            "border border-gray-200/60 dark:border-gray-700/60",
          )}
        >
          {/* Panel header */}
          <div className="shrink-0 bg-background px-4 pt-4 pb-3 border-b border-gray-100/60 dark:border-gray-800/60 rounded-t-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Store Notes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Debrief notes &amp; due key values</p>
              </div>
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

          {/* Store picker + Section navigation — same row */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-100/40 dark:border-gray-800/40">
            <div className="flex items-end gap-2">
              {/* Store */}
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Store</Label>
                <Select
                  value={selectedStoreId ?? ""}
                  onValueChange={(v) => setSelectedStoreId(v || null)}
                  disabled={stores.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs mt-1.5 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue
                      placeholder={stores.length === 0 ? "No stores found" : "Select store"}
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
              </div>

              {/* Jump-to navigation */}
              <div className="w-32 shrink-0">
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Jump to</Label>
                <Select
                  value={activeNav}
                  onValueChange={(v) => scrollToSection(v as "debrief" | "due-keys")}
                >
                  <SelectTrigger className="h-8 text-xs mt-1.5 border-gray-200/60 dark:border-gray-700/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="debrief">
                      <span className="flex items-center gap-1.5">
                        <PenLine className="h-3 w-3" />
                        Debrief
                      </span>
                    </SelectItem>
                    <SelectItem value="due-keys">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="h-3 w-3" />
                        Due Keys
                        {unfilledItems.length > 0 && (
                          <span className="ml-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                            {unfilledItems.length}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Scrollable sections container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
          >
            {/* ── Debrief Section ─────────────────────────────────────── */}
            <div ref={debriefSectionRef} className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Debrief</h4>
              </div>
              <CreateEmployeeDebriefForm
                storeId={selectedStoreId}
                isSubmitting={isSubmitting}
                submitError={createError}
                onClearError={clearCreateError}
                employees={dueKeysData?.employees ?? []}
                onSubmit={async (payload) => {
                  if (!selectedStoreId) return false;
                  const success = await createDebrief(selectedStoreId, payload);
                  if (success) {
                    toast.success("Debrief submitted successfully.");
                  }
                  return success;
                }}
              />
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-gray-200/60 dark:border-gray-700/60" />

            {/* ── Due Keys Section ─────────────────────────────────────── */}
            <div ref={dueKeysSectionRef} className="py-4">
              <div className="flex items-center gap-2 mb-3 px-4">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Due Keys</h4>
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
                    Select a store to load due keys.
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No due keys for this date.
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
                          <span className="shrink-0 text-[11px] text-muted-foreground max-w-18 truncate">
                            {renderValuePreview(item)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB button — drag to reposition vertically */}
      <div
        className={cn(
          "fixed z-50 right-6",
          position === "bottom" ? "bottom-6" : "top-15",
        )}
      >
        <Button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
          className={cn(
            "gap-2 rounded-full",
            "h-11 px-5 text-sm font-medium shadow-lg",
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
          <span>Debrief</span>
        </Button>
        {!isOpen && unfilledItems.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none pointer-events-none">
            {unfilledItems.length}
          </span>
        )}
      </div>

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
