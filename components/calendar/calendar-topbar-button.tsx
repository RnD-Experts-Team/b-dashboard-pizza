"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useTodayEvents } from "@/lib/hooks/use-calendar-events";
import { suggestedStart } from "@/lib/calendar/dates";
import { EventDialog, type EditorTarget } from "./event-dialog";
import { TodayPanel } from "./today-panel";

/**
 * Topbar calendar indicator, mounted next to the Drive-Thru button (the
 * sanctioned one-line topbar mount). A badge counts today's events until
 * "Mark all seen"; the popover lists today and opens the full calendar.
 *
 * Today's events ignore the page's category filters and search — the badge
 * answers "what's on today", not "what does my current filter show".
 */
export function CalendarTopbarButton() {
  const t = useTranslations("calendar.topbar");
  const { events, todayKey, now } = useTodayEvents();
  const seenDay = useCalendarStore((s) => s.seenDay);
  const markSeen = useCalendarStore((s) => s.markSeen);
  const [open, setOpen] = useState(false);
  // The global add: the same dialog as the Calendar page, usable from any page.
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  // Nothing until mounted: the count depends on the client clock + persisted "seen" day.
  if (now == null || todayKey == null) return null;

  const unseen = seenDay === todayKey ? 0 : events.length;
  const label = unseen > 9 ? "9+" : String(unseen);

  return (
    <div data-guide-id="topbar-calendar" className="relative flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        {/* Tooltip OUTSIDE PopoverAnchor: the anchor needs a real DOM child to measure. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverAnchor asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("trigger")}. ${t("hintCount", { n: events.length })}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="relative"
              >
                <CalendarDays className="h-[1.2rem] w-[1.2rem]" />
                {unseen > 0 && (
                  <span
                    aria-hidden
                    className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 animate-in zoom-in-50 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background duration-300 motion-reduce:animate-none"
                  >
                    {label}
                  </span>
                )}
              </Button>
            </PopoverAnchor>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="bottom" className="tabular-nums">
              {t("hintCount", { n: events.length })}
            </TooltipContent>
          )}
        </Tooltip>

        <PopoverContent align="end" className="w-auto p-0">
          <TodayPanel
            events={events}
            now={now}
            unseen={unseen}
            onMarkSeen={() => markSeen(todayKey)}
            onNavigate={() => setOpen(false)}
            onNewEvent={() => {
              setOpen(false);
              setEditor({ kind: "create", start: suggestedStart(new Date(now), now) });
            }}
          />
        </PopoverContent>
      </Popover>
      <EventDialog
        target={editor}
        onOpenChange={(o) => !o && setEditor(null)}
        onSaved={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}
