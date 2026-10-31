"use client";

import {
  Car,
  Check,
  Circle,
  Coffee,
  Link2,
  Link2Off,
  MapPin,
  Moon,
  ShoppingBag,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TRIP_STATE_TONE } from "@/lib/maintenance-trips";
import {
  TRIP_STATES,
  TRIP_STATUSES,
  TRIP_STOP_STATUSES,
  VISIT_TASK_STATUSES,
  vocabText,
} from "@/lib/maintenance/vocabulary";
import type { TripState, TripStatus, TripStopStatus, VisitTaskStatus } from "@/types/maintenance-system";

/** lucide names used by the trips vocabulary → components. */
export const TRIP_ICONS: Record<string, LucideIcon> = {
  Moon,
  Timer,
  Coffee,
  Car,
  ShoppingBag,
  MapPin,
  Check,
  X,
  LogIn: Timer,
  LogOut: Moon,
};

/** A vocabulary icon by its lucide name (a dot when unknown). */
export function VocabIcon({ name, className }: { name: string | undefined; className?: string }) {
  const Icon = (name && TRIP_ICONS[name]) || Circle;
  return <Icon className={className} aria-hidden="true" />;
}

const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

/** What the technician is doing now: icon + words, never colour alone. */
export function TripStateBadge({ state, className }: { state: TripState; className?: string }) {
  const t = useTranslations("maintenanceSystem");
  const entry = TRIP_STATES[state];
  return (
    <span className={cn(PILL, TRIP_STATE_TONE[state], className)}>
      <VocabIcon name={entry.icon} className="h-3 w-3" />
      {vocabText(t, entry)}
    </span>
  );
}

const STATUS_TONE: Record<TripStatus, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  closed: "bg-muted text-muted-foreground",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const t = useTranslations("maintenanceSystem");
  return <span className={cn(PILL, STATUS_TONE[status])}>{vocabText(t, TRIP_STATUSES[status])}</span>;
}

/** Link working or not, with an icon. */
export function LinkStatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("maintenanceSystem");
  const Icon = active ? Link2 : Link2Off;
  return (
    <span
      className={cn(
        PILL,
        active
          ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {active ? t("trips.linkActive") : t("trips.linkExpired")}
    </span>
  );
}

const STOP_TONE: Record<TripStopStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  arrived: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  not_done: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

export function StopStatusBadge({ status, className }: { status: TripStopStatus; className?: string }) {
  const t = useTranslations("maintenanceSystem");
  const entry = TRIP_STOP_STATUSES[status];
  return (
    <span className={cn(PILL, STOP_TONE[status] ?? STOP_TONE.planned, className)}>
      {entry?.icon && <VocabIcon name={entry.icon} className="h-3 w-3" />}
      {vocabText(t, entry)}
    </span>
  );
}

const TASK_TONE: Record<VisitTaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  not_done: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

export function TaskStatusBadge({ status, className }: { status: VisitTaskStatus; className?: string }) {
  const t = useTranslations("maintenanceSystem");
  const entry = VISIT_TASK_STATUSES[status];
  return (
    <span className={cn(PILL, TASK_TONE[status] ?? TASK_TONE.pending, className)}>
      {entry?.icon && <VocabIcon name={entry.icon} className="h-3 w-3" />}
      {vocabText(t, entry)}
    </span>
  );
}
