"use client";

import React, { useLayoutEffect, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Pizza, Loader2, CheckCircle2, Clock, AlertCircle, RefreshCw,
  Download, File, FileText, FileArchive, FileVideo, FileAudio, FileCode, FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDueKeysFeed } from "@/lib/hooks/use-due-keys-feed";
import type { DueKeyItem, DueKeyValue, Employee, DueKeyAttachment } from "@/types/due-key.types";

// --- Helpers ------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-rose-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-purple-500", "bg-cyan-500", "bg-pink-500",
];

async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // silently ignore — browser may block if resource is unavailable
  }
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getDisplayValue(item: DueKeyItem): string {
  const v = item.value;
  if (!v) return "";
  if (v.valueText != null) return v.valueText;
  if (v.valueNumber != null) return String(v.valueNumber);
  if (v.valueBoolean != null) return v.valueBoolean ? "Yes" : "No";
  if (v.valueJson != null) return JSON.stringify(v.valueJson);
  return "";
}

type FileIconInfo = { Icon: React.ElementType; color: string; label: string };

function getFileIconInfo(mimeType: string): FileIconInfo {
  if (mimeType.startsWith("image/"))                                              return { Icon: FileImage,   color: "text-blue-400",    label: "IMG"   };
  if (mimeType === "application/pdf")                                             return { Icon: FileText,    color: "text-red-400",     label: "PDF"   };
  if (mimeType.includes("word") || mimeType.includes("document"))                return { Icon: FileText,    color: "text-sky-400",     label: "DOC"   };
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))            return { Icon: FileText,    color: "text-green-400",   label: "XLS"   };
  if (mimeType.includes("csv"))                                                   return { Icon: FileText,    color: "text-green-400",   label: "CSV"   };
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) return { Icon: FileArchive, color: "text-amber-400",   label: "ZIP"   };
  if (mimeType.startsWith("video/"))                                              return { Icon: FileVideo,   color: "text-purple-400",  label: "VIDEO" };
  if (mimeType.startsWith("audio/"))                                              return { Icon: FileAudio,   color: "text-pink-400",    label: "AUDIO" };
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("javascript") || mimeType.includes("html")) return { Icon: FileCode, color: "text-cyan-400", label: "CODE" };
  return { Icon: File, color: "text-muted-foreground", label: "FILE" };
}

// --- Sub-components -----------------------------------------------------------

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 select-none">
      <div className="h-px flex-1 " />
      <span className="rounded-full border border-border/60 bg-muted/80 px-3 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground shadow-sm">
        {label}
      </span>
      <div className="h-px flex-1 " />
    </div>
  );
}

function AttachmentPlaceholder() {
  return (
    <div></div>
    // <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/30">
    //   <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
    //     <Pizza className="h-8 w-8" strokeWidth={1.5} />
    //     <span className="text-[11px] font-medium tracking-wide">No attachment</span>
    //   </div>
    // </div>
  );
}

function AttachmentImage({ att }: { att: DueKeyAttachment }) {
  return (
    <div className="group relative overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={att.attachmentUrl}
        alt={att.originalName}
        className="w-full rounded-lg object-cover"
        style={{ maxHeight: "180px" }}
      />
      {/* Hover overlay with open + download */}
      <div className="absolute inset-0 flex items-end justify-end gap-1.5 bg-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={att.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View full size"
          className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
          onClick={(e) => e.stopPropagation()}
        >
          <FileImage className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          title="Download"
          className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
          onClick={(e) => { e.stopPropagation(); downloadFile(att.attachmentUrl, att.originalName); }}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AttachmentFile({ att }: { att: DueKeyAttachment }) {
  const { Icon, color, label } = getFileIconInfo(att.mimeType);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 p-2.5">
      <div className={cn("shrink-0", color)}>
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight text-foreground/80">{att.originalName}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{label} &bull; {(att.size / 1024).toFixed(0)} KB</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={att.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          title="Download"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => downloadFile(att.attachmentUrl, att.originalName)}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface FeedCardProps {
  item: DueKeyItem;
  employee: Employee | null;
  storeId: string;
}

function FeedCard({ item, employee, storeId }: FeedCardProps) {
  const v = item.value!;
  const fullName =
    v.userName
      ? v.userName
      : employee
        ? [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ")
        : `User #${v.userId}`;
  const initials = employee
    ? getInitials(employee.firstName, employee.lastName)
    : fullName.length >= 2
      ? fullName.slice(0, 2).toUpperCase()
      : String(v.userId).slice(0, 2).toUpperCase();
  const avatarBg = getAvatarColor(fullName);
  const displayValue = getDisplayValue(item);
  const attachments = v.attachments ?? [];

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex gap-3 items-start">
        <div className="shrink-0 pt-0.5">
          <Avatar className="h-9 w-9 ring-2 ring-border/40">
            <AvatarImage src={undefined} alt={fullName} />
            <AvatarFallback className={cn("text-[11px] font-bold text-white", avatarBg)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight">{fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {item.tags.length > 0 ? (
                    item.tags.map((tag) => (
                      <span key={tag.id} className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                        #{tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {item.label}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">Store {storeId}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground/80">{formatTime(v.createdAt)}</span>
                <div className="flex items-center gap-1 min-w-0">
                  {displayValue && (
                    <span className="text-[10px] font-medium text-foreground/70 break-all whitespace-pre-line max-w-xs">{displayValue}</span>
                  )}
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              </div>
            </div>

            {v.note && (
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{v.note}</p>
            )}

            {attachments.length > 0 ? (
              <div className={cn("grid gap-2", attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {attachments.map((att) =>
                  att.mimeType.startsWith("image/") ? (
                    <AttachmentImage key={att.id} att={att} />
                  ) : (
                    <AttachmentFile key={att.id} att={att} />
                  )
                )}
              </div>
            ) : (
              <AttachmentPlaceholder />
            )}
          </div>
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

// --- Main Component -----------------------------------------------------------

interface DueKeysFeedProps {
  storeId: string | null;
  /** Start of the date range (YYYY-MM-DD). Defaults to 2 days before dateTo. */
  dateFrom?: string | null;
  /** End of the date range (YYYY-MM-DD). Defaults to today. */
  dateTo?: string | null;
  /** Tag IDs to filter by */
  selectedTags?: number[] | null;
  updateKeyRef?: React.MutableRefObject<((date: string, keyId: number, value: DueKeyValue) => void) | null>;
}

export function DueKeysFeed({ storeId, dateFrom, dateTo, selectedTags, updateKeyRef }: DueKeysFeedProps) {
  const { pages, isLoading, isLoadingMore, hasMore, error, loadMore, reload, updateKeyValue } =
    useDueKeysFeed(
      storeId,
      storeId ? dateFrom : null,
      storeId ? dateTo : null,
      storeId ? selectedTags : null,
    );

  // Expose updateKeyValue to the parent via a stable mutable ref
  useEffect(() => {
    if (updateKeyRef) updateKeyRef.current = updateKeyValue;
  }, [updateKeyRef, updateKeyValue]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  // Scroll to bottom on first load
  useLayoutEffect(() => {
    if (!isLoading && pages.length > 0 && !didScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      didScrollRef.current = true;
    }
  }, [isLoading, pages]);

  // Reset scroll flag when store/date changes
  useEffect(() => {
    didScrollRef.current = false;
    prevScrollHeightRef.current = 0;
  }, [storeId, dateFrom, dateTo]);

  // After prepending older pages, restore relative scroll position
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [pages]);

  // IntersectionObserver: only trigger load-more when the container is actually
  // scrollable (scrollHeight > clientHeight). This prevents the infinite-request
  // loop that happens when there is too little content to create a scrollbar.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          const el = scrollRef.current;
          if (el && el.scrollHeight > el.clientHeight + 10) {
            prevScrollHeightRef.current = el.scrollHeight;
            loadMore();
          }
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

  const employeeMap = new Map<number, Employee>();
  for (const page of pages) {
    for (const emp of page.employees) {
      employeeMap.set(emp.id, emp);
    }
  }

  const totalFilled = pages.reduce(
    (acc, p) => acc + p.items.filter((i) => i.filled && i.value).length,
    0
  );

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
      {/* ── Header bar with refresh button ── */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70">
          <Clock className="me-1 inline h-3 w-3" />
          Showing last 3 days · scroll up to load older
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={isLoading}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex h-130 flex-col overflow-y-auto rounded-2xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur-sm"
        style={{ scrollbarGutter: "stable" }}
      >
        <div ref={sentinelRef} className="shrink-0" />

        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading older entries…</span>
          </div>
        )}

        {!hasMore && totalFilled > 0 && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-[11px] text-muted-foreground/60">Beginning of history</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="me-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-1 flex-col gap-5 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <FeedCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && !error && totalFilled === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Pizza className="h-10 w-10 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">No filled keys found for this store and date.</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-1 flex-col gap-2">
            {pages.map((page) => {
              const filledItems = page.items
                .filter((i) => i.filled && i.value)
                .sort((a, b) => (a.value?.createdAt ?? "").localeCompare(b.value?.createdAt ?? ""));
              if (filledItems.length === 0) return null;
              return (
                <div key={page.date} className="flex flex-col gap-3">
                  {/* Sticky date header — pins to top of scroll container as user scrolls */}
                  <div className="sticky top-0 z-10 -mx-4 px-4 pb-1 bg-transparent">
                    <DayDivider label={formatDayLabel(page.date)} />
                  </div>
                  {filledItems.map((item) => (
                    <FeedCard
                      key={`${page.date}-${item.keyId}`}
                      item={item}
                      employee={
                        item.value?.userId != null
                          ? (employeeMap.get(item.value.userId) ?? null)
                          : null
                      }
                      storeId={storeId}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-2 shrink-0" />
      </div>
    </div>
  );
}