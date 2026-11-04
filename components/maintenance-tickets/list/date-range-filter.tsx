"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LONG_RANGE_PRESETS, matchPreset, presetDays, type RangePreset } from "@/lib/maintenance-tickets/local-range";

const SHORT_DAY = "MMM d";
const PRESETS: { id: RangePreset; key: string }[] = [
  { id: "today", key: "tickets.list.range.today" },
  ...LONG_RANGE_PRESETS.map((p) => ({ id: p.id, key: `tickets.list.range.${p.id}` })),
];

function short(day: string): string {
  const d = parseISO(day);
  return Number.isNaN(d.getTime()) ? day : format(d, SHORT_DAY);
}

/**
 * "Opened: Nov 1 – Nov 4" in the tickets' filter row: presets and two day
 * pickers in one popover. Both ends are days, both included; either may be
 * left open ("from Nov 1", "until Nov 4"). Empty = any time.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  disabled,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const [open, setOpen] = useState(false);
  const active = from && to ? matchPreset(from, to, undefined, PRESETS) : null;

  const summary = (() => {
    if (active) return t(PRESETS.find((p) => p.id === active)?.key ?? "tickets.list.range.any");
    if (from && to) return from === to ? short(from) : `${short(from)} – ${short(to)}`;
    if (from) return t("tickets.list.range.since", { day: short(from) });
    if (to) return t("tickets.list.range.until", { day: short(to) });
    return t("tickets.list.range.any");
  })();
  const picked = Boolean(from || to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 font-normal", picked && "border-primary/50")} disabled={disabled}>
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">{t("tickets.list.range.label")}:</span>
          <span className={cn(picked && "font-medium")}>{summary}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-3 p-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("tickets.list.range.label")}>
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={active === p.id ? "default" : "outline"}
              className="h-8"
              onClick={() => {
                const days = presetDays(p.id);
                onChange(days.startDate, days.endDate);
                setOpen(false);
              }}
            >
              {t(p.key)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="block">{t("analytics.from")}</span>
            <DatePicker value={from} onChange={(v) => onChange(v, to && v && v > to ? v : to)} className="w-36" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="block">{t("analytics.to")}</span>
            <DatePicker value={to} onChange={(v) => onChange(from && v && v < from ? v : from, v)} className="w-36" />
          </label>
          {picked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
            >
              {t("tickets.list.range.clear")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
