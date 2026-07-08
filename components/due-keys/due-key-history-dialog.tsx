"use client";

import { useEffect } from "react";
import { AlertCircle, Clock, History, Paperclip, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDueKeyValueHistory } from "@/lib/hooks/use-due-keys";
import { getValueDisplay, formatDateTime } from "@/components/due-keys/due-key-value-format";

interface DueKeyHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  keyId: number;
  date: string;
  label: string;
}

export function DueKeyHistoryDialog({
  open,
  onOpenChange,
  storeId,
  keyId,
  date,
  label,
}: DueKeyHistoryDialogProps) {
  const { history, isLoading, error, fetchHistory, reset } = useDueKeyValueHistory();

  useEffect(() => {
    if (open) {
      fetchHistory(storeId, keyId, date);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storeId, keyId, date]);

  const current = history?.find((h) => !h.isMistaken) ?? null;
  const superseded = history?.filter((h) => h.isMistaken) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {label}
          </DialogTitle>
          <DialogDescription>
            Value history · Store {storeId} · {date}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchHistory(storeId, keyId, date)}
            >
              <RefreshCw className="me-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && history && history.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No value history found for this entry.
          </p>
        )}

        {!isLoading && !error && history && history.length > 0 && (
          <div className="space-y-3">
            {current && (
              <HistoryRow value={current} isCurrent />
            )}
            {superseded.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Previous values ({superseded.length})
                </p>
                <ul className="space-y-2">
                  {superseded.map((h) => (
                    <li key={h.id}>
                      <HistoryRow value={h} isCurrent={false} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryRow({ value, isCurrent }: { value: import("@/types/due-key.types").DueKeyValue; isCurrent: boolean }) {
  const { display } = getValueDisplay(value);
  const isJson = display.startsWith("{") || display.startsWith("[");
  const timestamp = isCurrent ? value.updatedAt : value.supersededAt;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {isCurrent ? (
          <Badge variant="default" className="text-[10px]">Current</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] text-muted-foreground">Superseded</Badge>
        )}
        {timestamp && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatDateTime(timestamp)}
          </span>
        )}
      </div>

      {isJson ? (
        <pre
          className={cn(
            "overflow-auto rounded border bg-background/60 p-2 text-xs whitespace-pre-wrap break-all max-h-40",
            !isCurrent && "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {display}
        </pre>
      ) : (
        <p
          className={cn(
            "text-sm break-all",
            !isCurrent && "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {display}
        </p>
      )}

      <p className="mt-1 text-[11px] text-muted-foreground/80">
        {value.userName ?? `User #${value.userId}`}
      </p>

      {value.note && (
        <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap break-all">
          {value.note}
        </p>
      )}

      {value.attachments.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {value.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1.5 text-[11px]">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <a
                href={a.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {a.originalName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
