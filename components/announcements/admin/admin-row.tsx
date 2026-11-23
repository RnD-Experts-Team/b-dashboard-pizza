"use client";

import { memo, useState } from "react";
import { CalendarDays, Eye, Heart, Megaphone, Pencil, Pin, Play, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { safeMediaUrl } from "@/lib/announcements/media";
import {
  announcementStatus,
  formatWindow,
  type AnnouncementStatus,
} from "@/lib/announcements/status";
import type { Announcement } from "@/types/announcement.types";
import { typeMetaOf } from "../shared/type-meta";

/** Soft fills, -600 text with a dark pair: green is live, blue is waiting, amber is over, grey is off. */
const STATUS_STYLES: Record<AnnouncementStatus, { chip: string; dot: string }> = {
  live: {
    chip: "border-emerald-500/25 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  scheduled: {
    chip: "border-blue-500/25 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  expired: {
    chip: "border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  inactive: {
    chip: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export interface AdminRowProps {
  announcement: Announcement;
  /** "Now", so every row of a list agrees on what is live. */
  now: number;
  onPreview: (announcement: Announcement) => void;
  onEdit: (id: number) => void;
  onDelete: (announcement: Announcement) => void;
}

/** A small picture of what the announcement carries: its image / GIF, a video frame, or nothing. */
function Thumb({ announcement }: { announcement: Announcement }) {
  const t = useTranslations("announcements.admin");
  const [failed, setFailed] = useState(false);
  const src = safeMediaUrl(announcement.media_url);
  const type = announcement.media_type;
  const showMedia = !!src && !!type && !failed;

  return (
    <div
      data-slot="admin-thumb"
      className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted md:size-[4.5rem]"
    >
      {showMedia && type === "video" && (
        <>
          <video
            src={`${src}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
            aria-hidden
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-white">
            <Play className="size-4 fill-current" aria-hidden />
          </span>
        </>
      )}
      {showMedia && type !== "video" && (
        // eslint-disable-next-line @next/next/no-img-element -- an arbitrary storage / GIF host
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
      {!showMedia && (
        <span className="flex size-full items-center justify-center text-muted-foreground/60">
          <Megaphone className="size-5" aria-hidden />
          <span className="sr-only">{t("noMedia")}</span>
        </span>
      )}
    </div>
  );
}

function AdminRowBase({ announcement, now, onPreview, onEdit, onDelete }: AdminRowProps) {
  const t = useTranslations("announcements");
  const tAdmin = useTranslations("announcements.admin");
  const tWindow = useTranslations("announcements.window");
  const locale = useLocale();

  const status = announcementStatus(announcement, now);
  const statusStyle = STATUS_STYLES[status];
  const meta = typeMetaOf(announcement.type);
  const likes = announcement.likes_count ?? 0;

  const windowText = formatWindow(announcement, locale, {
    noStart: tWindow("noStart"),
    noEnd: tWindow("noEnd"),
  });

  const actions = [
    {
      key: "preview",
      label: tAdmin("preview"),
      Icon: Eye,
      run: () => onPreview(announcement),
      danger: false,
    },
    {
      key: "edit",
      label: tAdmin("edit"),
      Icon: Pencil,
      run: () => onEdit(announcement.id),
      danger: false,
    },
    {
      key: "delete",
      label: tAdmin("delete"),
      Icon: Trash2,
      run: () => onDelete(announcement),
      danger: true,
    },
  ] as const;

  return (
    <li
      data-slot="admin-row"
      className="min-w-0 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/30 motion-reduce:transition-none md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-4"
    >
      <div className="flex min-w-0 gap-3">
        <Thumb announcement={announcement} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3
              title={announcement.title}
              className="line-clamp-1 min-w-0 font-heading text-sm font-semibold break-words [overflow-wrap:anywhere]"
            >
              {announcement.title}
            </h3>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t(meta.labelKey)}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                statusStyle.chip,
              )}
            >
              <span className={cn("size-1.5 rounded-full", statusStyle.dot)} aria-hidden />
              {t(`status.${status}`)}
            </span>

            {announcement.is_pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Pin className="size-3" aria-hidden />
                {tAdmin("pinned")}
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground tabular-nums">
              <Heart className="size-3" aria-hidden />
              <span className="sr-only">{tAdmin("likes", { count: likes })}</span>
              <span aria-hidden>{new Intl.NumberFormat(locale).format(likes)}</span>
            </span>
          </div>

          <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{windowText}</span>
          </p>
        </div>
      </div>

      {/* Phones: labelled buttons under the card */}
      <div className="mt-3 flex gap-2 border-t pt-3 md:hidden">
        {actions.map(({ key, label, Icon, run, danger }) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            onClick={run}
            className={cn(
              "min-w-0 flex-1 gap-1.5",
              danger && "text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
            )}
          >
            <Icon aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>

      {/* Tablets and up: icon buttons on the right of the row */}
      <div className="hidden items-center gap-0.5 md:flex">
        {actions.map(({ key, label, Icon, run, danger }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={run}
                aria-label={label}
                className={cn(
                  danger &&
                    "text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
                )}
              >
                <Icon aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </li>
  );
}

export const AdminRow = memo(AdminRowBase);

/** A row-shaped placeholder for the first load. */
export function AdminRowSkeleton() {
  return (
    <li
      aria-hidden
      className="min-w-0 rounded-xl border bg-card p-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-4"
    >
      <div className="flex min-w-0 gap-3">
        <Skeleton className="size-14 shrink-0 rounded-lg md:size-[4.5rem]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-8" />
          </div>
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="hidden items-center gap-1.5 md:flex">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </li>
  );
}
