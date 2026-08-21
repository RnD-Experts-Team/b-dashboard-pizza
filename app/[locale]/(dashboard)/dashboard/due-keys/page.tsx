"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CombinedFeed } from "@/components/due-keys/combined-feed";
import { InlineDueKeyInput } from "@/components/due-keys/inline-due-key-input";
import { InlineDebriefInput } from "@/components/due-keys/inline-debrief-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTagsList } from "@/lib/hooks/use-tags";
import { useDueKeys } from "@/lib/hooks/use-due-keys";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import type { DueKeyValue } from "@/types/due-key.types";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Tag, CalendarIcon, KeyRound, ClipboardList, UserRound, Check, Search, SlidersHorizontal } from "lucide-react";

function strToDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr(): string {
  return dateToStr(new Date());
}

// ─────────────────────────────────────────────────────────────────────────────
// UI NAMING NOTE (for AI context):
//   • "Due Keys"  in the codebase (variables, hooks, types) = displayed as "Debrief" in the UI
//   • "Debrief"   in the codebase (variables, hooks, types) = displayed as "Employee Debrief" in the UI
// Do NOT rename variables/functions/types — only UI text strings follow these display names.
// ─────────────────────────────────────────────────────────────────────────────
export default function DueKeysPage() {
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  const [showDueKeys, setShowDueKeys] = useState(true);
  const [showDebrief, setShowDebrief] = useState(true);
  const [submitMode, setSubmitMode] = useState<"due-key" | "debrief">("due-key");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return dateToStr(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => dateToStr(new Date()));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedDebriefTypeSlugs, setSelectedDebriefTypeSlugs] = useState<string[]>([]);

  // Feed injection refs — let inline inputs push new items into the feeds
  const debriefInjectRef = useRef<((item: EmployeeDebriefItem) => void) | null>(null);
  const dueKeyUpdateRef = useRef<((date: string, keyId: number, value: DueKeyValue) => void) | null>(null);
  const { data: tagsData, isLoading: isTagsLoading } = useTagsList();
  const availableTags = tagsData?.data ?? [];

  // Today's due keys — for the key selector & employees (debrief form)
  const today = useMemo(() => todayStr(), []);
  const { data: dueKeysData, isLoading: isDueKeysLoading } = useDueKeys(
    storeId,
    today,
    selectedTagIds.length > 0 ? selectedTagIds : undefined
  );
  const availableDebriefTypes = dueKeysData?.employeeDebriefTypes ?? [];

  // Badge count for mobile filter button
  const activeFilterCount =
    selectedTagIds.length +
    (selectedEmployeeId !== null ? 1 : 0) +
    selectedDebriefTypeSlugs.length +
    (!showDueKeys ? 1 : 0) +
    (!showDebrief ? 1 : 0);

  // ── Shared filter panel JSX (used in both desktop sidebar & mobile dialog) ──
  const filtersContent = (
    <div className="flex flex-col gap-2">

      {/* ── Tab switcher ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setShowDueKeys((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-colors",
              showDueKeys
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <div className="relative">
              <KeyRound className="h-4 w-4" />
              {showDueKeys && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2 w-2 text-primary-foreground" strokeWidth={3} />
                </span>
              )}
            </div>
            Debrief
          </button>
          <button
            type="button"
            onClick={() => setShowDebrief((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-colors",
              showDebrief
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <div className="relative">
              <ClipboardList className="h-4 w-4" />
              {showDebrief && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2 w-2 text-primary-foreground" strokeWidth={3} />
                </span>
              )}
            </div>
            Employee Debrief
          </button>
        </div>
      </div>

      {/* ── Date filter ── */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Date Range
          </p>
        </div>

        <p className="mb-1 text-[10px] font-medium text-muted-foreground">From</p>
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full justify-start gap-2 border-border/50 bg-background/60 px-2 text-left text-xs font-normal"
            >
              <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
              {format(strToDate(dateFrom), "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={strToDate(dateFrom)}
              onSelect={(d) => {
                if (!d) return;
                const s = dateToStr(d);
                setDateFrom(s);
                if (s > dateTo) setDateTo(s);
                setFromOpen(false);
              }}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <p className="mb-1 mt-2 text-[10px] font-medium text-muted-foreground">To</p>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full justify-start gap-2 border-border/50 bg-background/60 px-2 text-left text-xs font-normal"
            >
              <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
              {format(strToDate(dateTo), "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={strToDate(dateTo)}
              onSelect={(d) => {
                if (!d) return;
                const s = dateToStr(d);
                setDateTo(s);
                if (s < dateFrom) setDateFrom(s);
                setToOpen(false);
              }}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => {
            const t = dateToStr(new Date());
            const f = dateToStr(new Date(new Date().setDate(new Date().getDate() - 2)));
            setDateFrom(f);
            setDateTo(t);
          }}
          className="mt-1.5 text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
        >
          Reset to last 3 days
        </button>
      </div>

      {/* ── Tags — only when Due Keys is active ── */}
      {showDueKeys && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags
              </p>
            </div>
            {selectedTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTagIds([])}
                className="text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
              >
                Clear ({selectedTagIds.length})
              </button>
            )}
          </div>

          {isTagsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-24 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : availableTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags available.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {availableTags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`tag-${tag.id}`}
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      setSelectedTagIds((prev) =>
                        checked
                          ? [...prev, tag.id]
                          : prev.filter((id) => id !== tag.id)
                      );
                    }}
                  />
                  <label
                    htmlFor={`tag-${tag.id}`}
                    className="cursor-pointer truncate text-xs text-foreground/80 hover:text-foreground"
                  >
                    {tag.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Debrief type — only when Employee Debrief is active ── */}
      {showDebrief && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Type
              </p>
            </div>
            {selectedDebriefTypeSlugs.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDebriefTypeSlugs([])}
                className="text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
              >
                Clear ({selectedDebriefTypeSlugs.length})
              </button>
            )}
          </div>

          {isDueKeysLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-4 w-24 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : availableDebriefTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No debrief types available.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {availableDebriefTypes.map((type) => (
                <div key={type.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`debrief-type-${type.id}`}
                    checked={selectedDebriefTypeSlugs.includes(type.slug)}
                    onCheckedChange={(checked) => {
                      setSelectedDebriefTypeSlugs((prev) =>
                        checked
                          ? [...prev, type.slug]
                          : prev.filter((slug) => slug !== type.slug)
                      );
                    }}
                  />
                  <label
                    htmlFor={`debrief-type-${type.id}`}
                    className="cursor-pointer truncate text-xs text-foreground/80 hover:text-foreground"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Employees — only when Debrief is active ── */}
      {showDebrief && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Employee
              </p>
            </div>
            {selectedEmployeeId !== null && (
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 w-full rounded-md border border-border/50 bg-background/60 pl-6 pr-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0"
            />
          </div>

          {isDueKeysLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 w-28 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (dueKeysData?.employees ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No employees found.</p>
          ) : (
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-0.5" style={{ scrollbarGutter: "stable" }}>
              {(dueKeysData?.employees ?? [])
                .filter((emp) => {
                  if (!employeeSearch.trim()) return true;
                  const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ").toLowerCase();
                  return fullName.includes(employeeSearch.toLowerCase().trim());
                })
                .map((emp) => {
                  const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
                  const isSelected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(isSelected ? null : emp.id)}
                      className={cn(
                        "w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {fullName}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

    </div>
  );

  return (
    <div className="flex flex-col gap-2 p-2 sm:gap-3 sm:p-3">

      {/* ── Mobile: Filter button ─────────────────────────────────── */}
      <div className="flex items-center gap-2 lg:hidden">
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <button
            type="button"
            onClick={() => setFilterDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-muted/60"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-sm">
            <DialogHeader className="shrink-0">
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pe-1">
              {filtersContent}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">

        {/* ── Desktop: Sticky sidebar ───────────────────────────────── */}
        <div className="order-first hidden w-full shrink-0 lg:order-last lg:block lg:w-56 lg:sticky lg:top-4">
          {filtersContent}
        </div>

        {/* ── Main feed ────────────────────────────────────────────── */}
        <div className="order-last min-w-0 flex-1 lg:order-first">
          <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden">
            <CombinedFeed
              storeId={storeId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedTags={selectedTagIds.length > 0 ? selectedTagIds : null}
              employeeId={selectedEmployeeId}
              debriefTypeSlugs={selectedDebriefTypeSlugs.length > 0 ? selectedDebriefTypeSlugs : null}
              showDueKeys={showDueKeys}
              showDebrief={showDebrief}
              updateKeyRef={dueKeyUpdateRef}
              injectRef={debriefInjectRef}
            />
            {/* ── Submit-mode toggle (only when both are active) ── */}
            {showDueKeys && showDebrief && (
              <div className="flex items-center gap-1 border-t border-border/60 bg-muted/30 px-3 py-1.5">
                <span className="mr-1 text-[10px] font-medium text-muted-foreground">Add:</span>
                <button
                  type="button"
                  onClick={() => setSubmitMode("due-key")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                    submitMode === "due-key"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-3 w-3" />
                  Debrief
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitMode("debrief")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                    submitMode === "debrief"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <ClipboardList className="h-3 w-3" />
                  Employee Debrief
                </button>
              </div>
            )}

            {/* ── Inline inputs ── */}
            {showDueKeys && (!showDebrief || submitMode === "due-key") && (
              <InlineDueKeyInput
                storeId={storeId}
                onSuccess={(date, keyId, value) => dueKeyUpdateRef.current?.(date, keyId, value)}
              />
            )}
            {showDebrief && (!showDueKeys || submitMode === "debrief") && (
              <InlineDebriefInput
                storeId={storeId}
                employees={dueKeysData?.employees ?? []}
                debriefTypes={dueKeysData?.employeeDebriefTypes ?? []}
                onSuccess={(item) => debriefInjectRef.current?.(item)}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}