"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Pizza, Loader2, CheckCircle2, Clock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedEntry {
  id: string;
  employeeName: string;
  employeeInitials: string;
  employeePhoto: string | null;
  keyTag: string;
  keyLabel: string;
  storeNumber: string;
  attachment: string | null;
  filledAt: Date;
  value: string;
  note: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function createDate(daysAgo: number, hours: number, minutes: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const ALL_MOCK_ENTRIES: FeedEntry[] = [
  // ── 4 days ago ───────────────────────────────────────────────
  {
    id: "1",
    employeeName: "Mike Rodriguez",
    employeeInitials: "MR",
    employeePhoto: null,
    keyTag: "temp-log",
    keyLabel: "Temperature Log",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(4, 8, 15),
    value: "38°F",
    note: "Cooler was running warm earlier — had the technician check it and all is good now.",
  },
  {
    id: "2",
    employeeName: "Emma Chen",
    employeeInitials: "EC",
    employeePhoto: null,
    keyTag: "safety-audit",
    keyLabel: "Safety Audit",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(4, 14, 30),
    value: "Passed",
    note: "All fire exits were clear and equipment inspections passed without any issues.",
  },
  {
    id: "3",
    employeeName: "James Wilson",
    employeeInitials: "JW",
    employeePhoto: null,
    keyTag: "closing-check",
    keyLabel: "Closing Checklist",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(4, 22, 5),
    value: "Completed",
    note: "Locked up on time, left everything clean and fully stocked for the morning shift.",
  },
  // ── 3 days ago ───────────────────────────────────────────────
  {
    id: "4",
    employeeName: "Lisa Park",
    employeeInitials: "LP",
    employeePhoto: null,
    keyTag: "morning-check",
    keyLabel: "Morning Opening Check",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(3, 7, 45),
    value: "Done",
    note: "Arrived early to preheat ovens — everything was in good order from last night's team.",
  },
  {
    id: "5",
    employeeName: "Tyler Johnson",
    employeeInitials: "TJ",
    employeePhoto: null,
    keyTag: "inventory-count",
    keyLabel: "Inventory Count",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(3, 11, 20),
    value: "142 units",
    note: "A few sauce cans were near expiry — flagged and moved to front stock for immediate use.",
  },
  {
    id: "6",
    employeeName: "Sarah Mills",
    employeeInitials: "SM",
    employeePhoto: null,
    keyTag: "evening-close",
    keyLabel: "Evening Closing",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(3, 21, 50),
    value: "Completed",
    note: "Smooth closing — one register was slightly off but balanced correctly after a recount.",
  },
  // ── 2 days ago ───────────────────────────────────────────────
  {
    id: "7",
    employeeName: "Mike Rodriguez",
    employeeInitials: "MR",
    employeePhoto: null,
    keyTag: "temp-log",
    keyLabel: "Temperature Log",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(2, 8, 10),
    value: "37°F",
    note: "Noticed the freezer door seal looks worn — submitted a maintenance request just in case.",
  },
  {
    id: "8",
    employeeName: "Emma Chen",
    employeeInitials: "EC",
    employeePhoto: null,
    keyTag: "dough-check",
    keyLabel: "Dough Preparation Check",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(2, 10, 0),
    value: "Ready",
    note: "All dough batches proofed perfectly today and are well within spec for the afternoon rush.",
  },
  {
    id: "9",
    employeeName: "James Wilson",
    employeeInitials: "JW",
    employeePhoto: null,
    keyTag: "safety-audit",
    keyLabel: "Safety Audit",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(2, 15, 35),
    value: "Passed",
    note: "Minor spill near the prep area had already been cleaned by the team before I checked.",
  },
  {
    id: "10",
    employeeName: "Lisa Park",
    employeeInitials: "LP",
    employeePhoto: null,
    keyTag: "closing-check",
    keyLabel: "Closing Checklist",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(2, 22, 15),
    value: "Done",
    note: "All stations closed properly, restrooms sanitized, and the alarm was set successfully.",
  },
  // ── Yesterday ────────────────────────────────────────────────
  {
    id: "11",
    employeeName: "Tyler Johnson",
    employeeInitials: "TJ",
    employeePhoto: null,
    keyTag: "morning-check",
    keyLabel: "Morning Opening Check",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(1, 7, 30),
    value: "Done",
    note: "Opening was smooth — all deliveries arrived on time and were stocked without issues.",
  },
  {
    id: "12",
    employeeName: "Sarah Mills",
    employeeInitials: "SM",
    employeePhoto: null,
    keyTag: "inventory-count",
    keyLabel: "Inventory Count",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(1, 9, 45),
    value: "158 units",
    note: "Cheese stock is running low — placed a reorder before the busy weekend rush.",
  },
  {
    id: "13",
    employeeName: "Mike Rodriguez",
    employeeInitials: "MR",
    employeePhoto: null,
    keyTag: "temp-log",
    keyLabel: "Temperature Log",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(1, 12, 0),
    value: "36°F",
    note: "All fridge temps are stable — no issues to report from the midday walkthrough.",
  },
  {
    id: "14",
    employeeName: "Emma Chen",
    employeeInitials: "EC",
    employeePhoto: null,
    keyTag: "dough-check",
    keyLabel: "Dough Preparation Check",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(1, 14, 20),
    value: "Ready",
    note: "Second dough batch needed an extra 10 minutes proof time due to the cooler kitchen temp.",
  },
  {
    id: "15",
    employeeName: "James Wilson",
    employeeInitials: "JW",
    employeePhoto: null,
    keyTag: "evening-close",
    keyLabel: "Evening Closing",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(1, 21, 55),
    value: "Completed",
    note: "Long shift today but everything closed properly and the kitchen was left spotless.",
  },
  // ── Today ─────────────────────────────────────────────────────
  {
    id: "16",
    employeeName: "Lisa Park",
    employeeInitials: "LP",
    employeePhoto: null,
    keyTag: "morning-check",
    keyLabel: "Morning Opening Check",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(0, 7, 15),
    value: "Done",
    note: "New hire helped with the opening today and everything went smoothly per the checklist.",
  },
  {
    id: "17",
    employeeName: "Tyler Johnson",
    employeeInitials: "TJ",
    employeePhoto: null,
    keyTag: "temp-log",
    keyLabel: "Temperature Log",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(0, 9, 0),
    value: "37°F",
    note: "Walk-in cooler is holding temp well following last week's maintenance visit.",
  },
  {
    id: "18",
    employeeName: "Sarah Mills",
    employeeInitials: "SM",
    employeePhoto: null,
    keyTag: "safety-audit",
    keyLabel: "Safety Audit",
    storeNumber: "42",
    attachment: null,
    filledAt: createDate(0, 11, 30),
    value: "Passed",
    note: "Fire extinguisher inspection tags are all up to date — everything clear this morning.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  "temp-log":        "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "safety-audit":    "bg-red-500/15 text-red-400 border-red-500/20",
  "morning-check":   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "closing-check":   "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "evening-close":   "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "inventory-count": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "dough-check":     "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-pink-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(entries: FeedEntry[]): { label: string; date: Date; items: FeedEntry[] }[] {
  const groups: Map<string, { label: string; date: Date; items: FeedEntry[] }> = new Map();

  for (const entry of entries) {
    const key = entry.filledAt.toDateString();
    if (!groups.has(key)) {
      groups.set(key, {
        label: formatDayLabel(entry.filledAt),
        date: entry.filledAt,
        items: [],
      });
    }
    groups.get(key)!.items.push(entry);
  }

  return Array.from(groups.values());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 select-none">
      <div className="h-px flex-1 bg-border/60" />
      <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function AttachmentPlaceholder() {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/30">
      <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
        <Pizza className="h-8 w-8" strokeWidth={1.5} />
        <span className="text-[11px] font-medium tracking-wide">No attachment</span>
      </div>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  const tagColorClass =
    TAG_COLORS[entry.keyTag] ?? "bg-muted text-muted-foreground border-border/50";
  const avatarBg = getAvatarColor(entry.employeeName);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <Avatar className="h-9 w-9 ring-2 ring-border/40">
          <AvatarImage src={entry.employeePhoto ?? undefined} alt={entry.employeeName} />
          <AvatarFallback
            className={cn("text-[11px] font-bold text-white", avatarBg)}
          >
            {entry.employeeInitials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Bubble */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Bubble card */}
        <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
          {/* Header row */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {entry.employeeName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                    tagColorClass
                  )}
                >
                  #{entry.keyTag}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Store {entry.storeNumber}
                </span>
              </div>
            </div>
            {/* Time + filled indicator */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground/80">{formatTime(entry.filledAt)}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>

          {/* Submitter note */}
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            {entry.note}
          </p>

          {/* Attachment area */}
          {entry.attachment ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.attachment}
              alt="Attachment"
              className="w-full rounded-lg object-cover"
              style={{ maxHeight: "160px" }}
            />
          ) : (
            <AttachmentPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

function FeedCardSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="aspect-video w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

interface DueKeysFeedProps {
  storeId: string | null;
  selectedDate?: string | null; // YYYY-MM-DD; null = show all history
}

export function DueKeysFeed({ storeId, selectedDate }: DueKeysFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  // Filter entries by date: show entries on or before selected date
  const allEntries = selectedDate
    ? ALL_MOCK_ENTRIES.filter((e) => {
        const entryDay = e.filledAt.toISOString().slice(0, 10);
        return entryDay <= selectedDate;
      })
    : ALL_MOCK_ENTRIES;
  const totalEntries = allEntries.length;

  const [loadedFrom, setLoadedFrom] = useState(Math.max(0, totalEntries - PAGE_SIZE));
  const [displayedItems, setDisplayedItems] = useState<FeedEntry[]>(
    allEntries.slice(Math.max(0, totalEntries - PAGE_SIZE))
  );
  const [hasMore, setHasMore] = useState(
    Math.max(0, totalEntries - PAGE_SIZE) > 0
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [didInitialScroll, setDidInitialScroll] = useState(false);

  // Reset feed when filters change
  useEffect(() => {
    const newFrom = Math.max(0, totalEntries - PAGE_SIZE);
    setLoadedFrom(newFrom);
    setDisplayedItems(allEntries.slice(newFrom));
    setHasMore(newFrom > 0);
    setDidInitialScroll(false);
    prevScrollHeightRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, selectedDate]);

  // Scroll to bottom after content renders (useLayoutEffect = before browser paint)
  useLayoutEffect(() => {
    if (scrollRef.current && !didInitialScroll && displayedItems.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setDidInitialScroll(true);
    }
  }, [didInitialScroll, displayedItems]);

  // After prepending, preserve scroll position
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [displayedItems]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;

    // Simulate async fetch
    setTimeout(() => {
      const newFrom = Math.max(0, loadedFrom - PAGE_SIZE);
      const newChunk = allEntries.slice(newFrom, loadedFrom);

      setDisplayedItems((prev) => [...newChunk, ...prev]);
      setLoadedFrom(newFrom);
      setHasMore(newFrom > 0);
      setIsLoadingMore(false);
    }, 800);
  }, [hasMore, isLoadingMore, loadedFrom, allEntries]);

  // IntersectionObserver for top sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const groups = groupByDay(displayedItems);

  if (!storeId) {
    return (
      <div className="flex h-130 items-center justify-center rounded-2xl border border-dashed border-border/50">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Pizza className="h-8 w-8 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">Select a store to view due keys.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex h-130 flex-col overflow-y-auto rounded-2xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur-sm"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* Top sentinel – triggers load more */}
        <div ref={sentinelRef} className="shrink-0" />

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading older entries…</span>
          </div>
        )}

        {/* "All caught up" indicator */}
        {!hasMore && displayedItems.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-[11px] text-muted-foreground/60">Beginning of history</span>
          </div>
        )}

        {/* Empty state */}
        {displayedItems.length === 0 && !isLoadingMore && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Pizza className="h-10 w-10 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">No filled keys yet for this store.</p>
          </div>
        )}

        {/* Day groups */}
        <div className="flex flex-1 flex-col gap-2">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <DayDivider label={group.label} />
              {group.items.map((entry) => (
                <FeedCard key={entry.id} entry={entry} />
              ))}
            </div>
          ))}
        </div>

        {/* Bottom spacer so last item isn't clipped */}
        <div className="h-2 shrink-0" />
      </div>

      {/* Scroll hint */}
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50 select-none">
        <Clock className="me-1 inline h-3 w-3" />
        Scroll up to view older filled keys
      </p>
    </div>
  );
}
