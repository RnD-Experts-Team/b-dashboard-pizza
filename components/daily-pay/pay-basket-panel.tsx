"use client";

import { Wallet, X, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePayBasketStore } from "@/lib/store/pay-basket.store";
import { describeBasket } from "@/lib/daily-pay/from-basket";

/**
 * Work marked for payment, waiting to become a sheet.
 *
 * Its own view, deliberately -- "so things don't complicate each other". This
 * is the staging area: the coordinator marks work as they come across it during
 * the day, and turns the lot into a sheet when they are ready. Nothing here is
 * saved upstream until they press the button and review what it filled in.
 *
 * Renders nothing when empty, so it costs no space on the days nobody used it.
 */

interface PayBasketPanelProps {
  /** Opens the entry dialog, prefilled from the basket. */
  onStartSheet: () => void;
  disabled?: boolean;
  className?: string;
}

export function PayBasketPanel({ onStartSheet, disabled, className }: PayBasketPanelProps) {
  const items = usePayBasketStore((s) => s.items);
  const remove = usePayBasketStore((s) => s.remove);
  const clear = usePayBasketStore((s) => s.clear);

  if (items.length === 0) return null;

  const summary = describeBasket(items);

  return (
    <div className={cn("rounded-lg border border-primary/40 bg-primary/5 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">
          {summary.issues === 1 ? "1 job marked for payment" : `${summary.issues} jobs marked for payment`}
        </span>
        <span className="text-xs text-muted-foreground">
          {summary.payees === 1 ? "1 payee" : `${summary.payees} payees`} ·{" "}
          {summary.stores === 1 ? "1 store" : `${summary.stores} stores`}
        </span>

        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" onClick={onStartSheet} disabled={disabled}>
            <FilePlus2 className="me-1.5 h-3.5 w-3.5" />
            Make a sheet from these
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={disabled}>
            Empty
          </Button>
        </div>
      </div>

      {/* Said before it happens, not discovered afterwards. */}
      {summary.unknownPayees > 0 && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
          {summary.unknownPayees === 1
            ? "One of these has nobody attached to it yet, so you will need to say who it is for."
            : `${summary.unknownPayees} of these have nobody attached yet, so you will need to say who they are for.`}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.issueId}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px]"
          >
            <span className="tabular-nums text-muted-foreground">#{item.ticketId}</span>
            <span className="max-w-40 truncate">{item.title}</span>
            {item.technicianName && (
              <span className="text-muted-foreground">· {item.technicianName}</span>
            )}
            <button
              type="button"
              onClick={() => remove(item.issueId)}
              aria-label={`Take ${item.title} off the sheet`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Hours are left blank on purpose — they come from the attendance already logged against
        these jobs. Typing them in would stop that.
      </p>
    </div>
  );
}
