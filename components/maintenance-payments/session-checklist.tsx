"use client";

import { format, isValid, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/maintenance/money";

export interface SessionOption {
  id: number;
  clockIn: string;
  clockOut: string | null;
  paidMinutes: number;
  stores?: string[];
}

function when(clockIn: string, clockOut: string | null): { day: string; span: string } {
  const start = parseISO(clockIn);
  if (!isValid(start)) return { day: clockIn, span: "" };
  const end = clockOut ? parseISO(clockOut) : null;
  const endText = end && isValid(end) ? format(end, "h:mm a") : "…";
  return { day: format(start, "EEE, MMM d"), span: `${format(start, "h:mm a")} – ${endText}` };
}

/**
 * The technician's clocked time not paid yet: tick sessions and the hourly
 * line's hours fill in from their paid time (breaks not counted). A session
 * already ticked on another line of this payment is shown but locked.
 */
export function SessionChecklist({
  id,
  sessions,
  selected,
  lockedIds,
  onToggle,
  invalid,
}: {
  id?: string;
  sessions: SessionOption[];
  selected: number[];
  /** On another line of this payment. */
  lockedIds: number[];
  onToggle: (sessionId: number) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("maintenanceSystem.payments");

  if (sessions.length === 0) {
    return (
      <p id={id} tabIndex={-1} className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("noUnpaidSessions")}
      </p>
    );
  }

  return (
    <div
      id={id}
      tabIndex={-1}
      role="group"
      className={cn("max-h-48 divide-y overflow-y-auto rounded-md border bg-background", invalid && "border-destructive")}
    >
      {sessions.map((s) => {
        const isOn = selected.includes(s.id);
        const locked = lockedIds.includes(s.id) && !isOn;
        const { day, span } = when(s.clockIn, s.clockOut);
        return (
          <button
            key={s.id}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            disabled={locked}
            onClick={() => onToggle(s.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors",
              locked ? "cursor-not-allowed opacity-50" : "hover:bg-muted/40",
              isOn && "bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                isOn ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {isOn && <Check className="h-3 w-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{day}</span>
              <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                {[span, s.stores?.length ? s.stores.join(", ") : null, locked ? t("onAnotherLine") : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums">{formatMinutes(s.paidMinutes)}</span>
          </button>
        );
      })}
    </div>
  );
}
