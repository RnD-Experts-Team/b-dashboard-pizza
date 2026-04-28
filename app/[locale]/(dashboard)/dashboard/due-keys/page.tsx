"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DueKeysFeed } from "@/components/due-keys/due-keys-feed";
import { DebriefsFeed } from "@/components/due-keys/debriefs-feed";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTagsList } from "@/lib/hooks/use-tags";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import { CalendarDays, Tag, CalendarIcon, KeyRound, ClipboardList } from "lucide-react";

/** Convert a YYYY-MM-DD string to a local Date (avoids UTC offset issues). */
function strToDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Convert a local Date to a YYYY-MM-DD string. */
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FeedMode = "due-keys" | "debrief";

export default function DueKeysPage() {
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? null;

  // ── Feed mode ─────────────────────────────────────────────────────
  const [feedMode, setFeedMode] = useState<FeedMode>("due-keys");

  // ── Due Keys date range ───────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return dateToStr(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => dateToStr(new Date()));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // ── Tag filter ────────────────────────────────────────────────────
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);;
  const { data: tagsData, isLoading: isTagsLoading } = useTagsList();
  const availableTags = tagsData?.data ?? [];

  return (
    <div className="flex flex-col gap-3 p-3 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="order-first w-full shrink-0 lg:order-last lg:w-64 lg:sticky lg:top-6">
          <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:space-y-3">
            {/* ── Tab switcher ── */}
            <div className="min-w-[180px] flex-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur-sm lg:min-w-0">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setFeedMode("due-keys")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] font-semibold transition-colors",
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
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] font-semibold transition-colors",
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
            <div className="min-w-[160px] flex-1 rounded-xl border border-border/60 bg-card/60 p-2 sm:p-4 backdrop-blur-sm lg:min-w-0">
              <div className="mb-3 flex items-center gap-2">
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
                        className="h-8 w-full justify-start gap-2 border-border/50 bg-background/60 px-3 text-left text-xs font-normal"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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

                  <p className="mb-1 mt-3 text-[10px] font-medium text-muted-foreground">To</p>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 border-border/50 bg-background/60 px-3 text-left text-xs font-normal"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
                      const today = dateToStr(new Date());
                      const from = dateToStr(
                        new Date(new Date().setDate(new Date().getDate() - 2))
                      );
                      setDateFrom(from);
                      setDateTo(today);
                    }}
                    className="mt-2 text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
                  >
                    Reset to last 3 days
                  </button>
            </div>

            {/* ── Tags — Due Keys only ── */}
            {feedMode === "due-keys" && (
              <div className="min-w-[160px] flex-1 rounded-xl border border-border/60 bg-card/60 p-2 sm:p-4 backdrop-blur-sm lg:min-w-0">
                <div className="mb-3 flex items-center justify-between gap-2">
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
          </div>
        </div>

        {/* ── Main feed ────────────────────────────────────────────── */}
        <div className="order-last min-w-0 flex-1 lg:order-first">
          {feedMode === "due-keys" ? (
            <DueKeysFeed
              storeId={storeId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedTags={selectedTagIds.length > 0 ? selectedTagIds : null}
            />
          ) : (
            <DebriefsFeed storeId={storeId} dateFrom={dateFrom} dateTo={dateTo} />
          )}
        </div>
      </div>
    </div>
  );
}