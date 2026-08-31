"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlugZap } from "lucide-react";
import type { SchedulingErrorCode } from "@/types/scheduling.types";

/**
 * The dead-end state for configuration failures.
 *
 * `STORE_NOT_MAPPED` and `POSITION_NOT_MAPPED` are not user errors — the store
 * has no Humanity location or no default Humanity position, and a manager
 * retrying will never succeed. So this deliberately does NOT offer a retry
 * button: it explains the situation and gives them a way to report it.
 */

export type SetupErrorCode = Extract<
  SchedulingErrorCode,
  "STORE_NOT_MAPPED" | "POSITION_NOT_MAPPED"
>;

const SETUP_COPY: Record<SetupErrorCode, { title: string; body: string }> = {
  STORE_NOT_MAPPED: {
    title: "This store isn't set up for scheduling yet",
    body: "It has not been linked to a location in the scheduling system, so shifts cannot be created for it. This needs a one-time setup by whoever administers the integration — it is not something you can fix from here.",
  },
  POSITION_NOT_MAPPED: {
    title: "This store has no default scheduling position",
    body: "Shifts need a position to be created against, and this store does not have one configured yet. This needs a one-time setup by whoever administers the integration — it is not something you can fix from here.",
  },
};

interface ScheduleSetupErrorProps {
  code: SetupErrorCode;
  /** The server's own message, shown as supporting detail when present. */
  message?: string | null;
  storeLabel?: string | null;
  /** Optional escalation action, e.g. opening a support ticket. */
  onReport?: () => void;
}

export function ScheduleSetupError({
  code,
  message,
  storeLabel,
  onReport,
}: ScheduleSetupErrorProps) {
  const { title, body } = SETUP_COPY[code];

  return (
    <Card className="border-2 border-dashed border-amber-500/40">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-amber-500/15 p-3 dark:bg-amber-500/20">
          <PlugZap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-heading text-sm font-semibold">{title}</h3>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">{body}</p>
          {storeLabel && (
            <p className="text-[11px] font-medium text-muted-foreground">
              Store: {storeLabel}
            </p>
          )}
          {message && (
            <p className="mx-auto max-w-md text-[11px] italic text-muted-foreground/80">
              {message}
            </p>
          )}
        </div>
        {onReport && (
          <Button variant="outline" size="sm" onClick={onReport}>
            Report this to support
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
