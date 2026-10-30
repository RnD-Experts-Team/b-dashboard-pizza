"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  CalendarPlus,
  Circle,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  History,
  Lock,
  LogOut,
  MapPin,
  MessageCircleQuestion,
  MessageCircleReply,
  Package,
  ScanSearch,
  ShoppingBag,
  Stamp,
  StickyNote,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TIMELINE_TONE_CLASS, actorName, timelineKindMeta } from "@/lib/maintenance-workflow";
import type { TimelineEntry } from "@/types/maintenance-v2";
import { LocalTimestamp } from "../local-timestamp";

const ICONS: Record<string, LucideIcon> = {
  ArrowRightLeft,
  CalendarClock,
  CalendarPlus,
  Circle,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  LogOut,
  MapPin,
  MessageCircleQuestion,
  MessageCircleReply,
  Package,
  ScanSearch,
  ShoppingBag,
  Stamp,
  StickyNote,
  Store,
  Wallet,
};

/** One vertical timeline, newest first: a dot and a card per event. */
export function ActivityTab({ entries }: { entries: TimelineEntry[] }) {
  const t = useTranslations("maintenanceV2.tickets.activity");

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <History className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 ps-10 before:absolute before:inset-y-2 before:start-4 before:w-px before:bg-border">
      {entries.map((e, index) => {
        const meta = timelineKindMeta(e.kind);
        const Icon = ICONS[meta.icon] ?? Circle;
        const who = actorName(e.actor);
        return (
          <li key={`${e.at}-${e.kind}-${index}`} className="relative">
            <span
              className={cn("absolute -start-10 top-2 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background", TIMELINE_TONE_CLASS[meta.tone])}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className={cn("rounded-lg border bg-card px-3 py-2", e.isPrivate && "border-dashed border-amber-500/50")}>
              <p className="whitespace-pre-wrap break-words text-sm">{e.text}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <LocalTimestamp iso={e.at} showZone={false} />
                {who ? <span>· {who}</span> : null}
                {e.isPrivate ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                    {t("mosOnly")}
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
