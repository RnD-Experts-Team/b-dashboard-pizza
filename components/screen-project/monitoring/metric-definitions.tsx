"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How every monitoring number is measured, in plain words. One list, used by
 * the report page, the manager sheet and the live debug panel, so the rules
 * read the same everywhere. The thresholds quoted here are the recorder's
 * (components/screen-project/usage/usage-probe.tsx, lib/screen-usage/face-detector.ts).
 */
export const METRIC_KEYS = [
  "connected",
  "present",
  "noFace",
  "covered",
  "cameraOff",
  "away",
  "micOpen",
  "talking",
  "silent",
  "deadMic",
  "talkAll",
  "pip",
  "favorite",
  "visits",
  "kicked",
  "timeZone",
  "saving",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/** One short "how it's calculated" line, for under a chart or a number. */
export function MetricNote({ metric, className }: { metric: MetricKey; className?: string }) {
  const t = useTranslations("screenMonitoring.how");
  return (
    <p className={cn("flex gap-1.5 text-xs leading-relaxed text-muted-foreground", className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground/80">{t(`${metric}.term`)}:</span> {t(`${metric}.how`)}
      </span>
    </p>
  );
}

/** The full list, as a collapsible card. */
export function MetricDefinitions({
  metrics = METRIC_KEYS,
  defaultOpen = false,
  className,
}: {
  metrics?: readonly MetricKey[];
  defaultOpen?: boolean;
  className?: string;
}) {
  const t = useTranslations("screenMonitoring.how");
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-start hover:bg-muted/30"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-semibold leading-tight">{t("title")}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{t("subtitle")}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <dl className="grid gap-x-8 gap-y-4 border-t px-5 py-5 sm:grid-cols-2">
          {metrics.map((m) => (
            <div key={m}>
              <dt className="text-sm font-medium">{t(`${m}.term`)}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t(`${m}.how`)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
