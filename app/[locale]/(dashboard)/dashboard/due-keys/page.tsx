"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { DueKeysFeed } from "@/components/due-keys/due-keys-feed";
import { DebriefsFeed } from "@/components/due-keys/debriefs-feed";
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
import { CalendarDays, Tag, CalendarIcon, KeyRound, ClipboardList, UserRound } from "lucide-react";

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

type FeedMode = "due-keys" | "debrief";

export default function DueKeysPage() {
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  const [feedMode, setFeedMode] = useState<FeedMode>("due-keys");

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return dateToStr(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => dateToStr(new Date()));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

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

  return (
    <div className="flex flex-col gap-2 p-2 sm:gap-3 sm:p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="order-first w-full shrink-0 lg:order-last lg:w-56 lg:sticky lg:top-4">
          <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:space-y-2">
            {/* ── Tab switcher ── */}
            <div className="min-w-45 flex-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm lg:min-w-0">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setFeedMode("due-keys")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-colors",
                    feedMode === "due-keys"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-4 w-4" />
                  Due Keys
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode("debrief")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-colors",
                    feedMode === "debrief"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  Debrief
                </button>
              </div>
            </div>

            {/* ── Date filter ── */}
            <div className="min-w-40 flex-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm lg:min-w-0">
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

            {/* ── Tags — Due Keys only ── */}
            {feedMode === "due-keys" && (
              <div className="min-w-40 flex-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm lg:min-w-0">
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

            {/* ── Employees — Debrief only ── */}
            {feedMode === "debrief" && (
              <div className="min-w-40 flex-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm lg:min-w-0">
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

                {isDueKeysLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-5 w-28 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : (dueKeysData?.employees ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No employees found.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {(dueKeysData?.employees ?? []).map((emp) => {
                      const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
                      const isSelected = selectedEmployeeId === emp.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() =>
                            setSelectedEmployeeId(isSelected ? null : emp.id)
                          }
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
        </div>

        {/* ── Main feed ────────────────────────────────────────────── */}
        <div className="order-last min-w-0 flex-1 lg:order-first">
          {feedMode === "due-keys" ? (
            <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden">
              <DueKeysFeed
                storeId={storeId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                selectedTags={selectedTagIds.length > 0 ? selectedTagIds : null}
                updateKeyRef={dueKeyUpdateRef}
              />
              <InlineDueKeyInput
                storeId={storeId}
                onSuccess={(date, keyId, value) => dueKeyUpdateRef.current?.(date, keyId, value)}
              />
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden">
              <DebriefsFeed storeId={storeId} dateFrom={dateFrom} dateTo={dateTo} employeeId={selectedEmployeeId} injectRef={debriefInjectRef} />
              <InlineDebriefInput
                storeId={storeId}
                employees={dueKeysData?.employees ?? []}
                onSuccess={(item) => debriefInjectRef.current?.(item)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}