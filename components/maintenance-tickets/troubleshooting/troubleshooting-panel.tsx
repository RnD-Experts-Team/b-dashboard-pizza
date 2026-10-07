"use client";

import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { TroubleshootingGuide } from "@/types/maintenance-tickets.types";
import { TroubleshootingSteps } from "./troubleshooting-steps";

/**
 * Shown in the new-ticket form as soon as an issue with a guide is picked:
 * the steps to try first, and the one box -- "I read these steps and tried
 * them" -- that has to be ticked before the ticket can be sent.
 */
export function TroubleshootingPanel({
  issueTitle,
  guide,
  confirmed,
  onConfirmedChange,
  showError,
}: {
  issueTitle: string;
  guide: TroubleshootingGuide;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  /** The form was submitted without the tick. */
  showError?: boolean;
}) {
  const id = `troubleshooting-confirm-${guide.id}`;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3",
        confirmed ? "border-emerald-500/40 bg-emerald-500/5" : "border-sky-500/40 bg-sky-500/5",
        showError && !confirmed && "border-destructive bg-destructive/5",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <LifeBuoy className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        Before you open a ticket for {issueTitle}, try these:
      </p>

      <TroubleshootingSteps steps={guide.steps} linkUrl={guide.linkUrl} attachments={guide.attachments} />

      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 rounded-md bg-background p-2 text-sm">
        <Checkbox
          id={id}
          checked={confirmed}
          onCheckedChange={(v) => onConfirmedChange(v === true)}
          className="mt-0.5"
          aria-invalid={showError && !confirmed}
        />
        <span>
          <span className="font-medium">I read these steps and tried them.</span>
          <span className="block text-xs text-muted-foreground">
            The problem is still there, so a ticket is needed. This is saved on the ticket.
          </span>
        </span>
      </label>
      {showError && !confirmed && (
        <p className="text-xs text-destructive">Tick the box once you have tried the steps -- the ticket cannot be sent without it.</p>
      )}
    </div>
  );
}
