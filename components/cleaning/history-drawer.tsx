"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Camera, Loader2, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type { HistoryEntry } from "@/types/cleaning.types";
import { StatusPill, PhotoThumbs } from "./cleaning-ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: number;
  taskId: number;
  taskLabel: string;
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function HistoryDrawer({ open, onOpenChange, storeId, taskId, taskLabel }: Props) {
  const t = useTranslations("cleaningChart.historyDrawer");
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntries(null);
    cleaningService
      .getHistory(storeId, taskId, undefined, controller.signal)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof CleaningError ? err.message : t("loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, storeId, taskId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">{taskLabel}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5">
          {loading && <HistorySkeleton />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {entries && entries.length === 0 && (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}

          {entries && entries.length > 0 && (
            <ol className="relative space-y-5 border-s ps-6">
              {entries.map((e, i) => (
                <li key={i} className="relative">
                  {/* timeline dot */}
                  <span
                    className={cn(
                      "absolute -start-[29px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-background",
                      e.status === "done" && "bg-green-500",
                      e.status === "overdue" && "bg-red-500",
                      e.status === "pending" && "bg-amber-500"
                    )}
                  />

                  <div className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                        {e.period[0]} → {e.period[1]}
                      </span>
                      <StatusPill status={e.status} />
                    </div>

                    {e.status === "done" ? (
                      <div className="mt-3 space-y-2.5 text-sm">
                        {e.doneBy.length > 0 && (
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span className="text-foreground">{e.doneBy.join(", ")}</span>
                          </p>
                        )}
                        {e.doneAt && (
                          <p className="text-xs text-muted-foreground">
                            {t("completedAt", { date: new Date(e.doneAt).toLocaleString() })}
                          </p>
                        )}
                        {e.note && (
                          <p className="rounded-md bg-muted/50 p-2.5 text-sm italic text-muted-foreground">
                            “{e.note}”
                          </p>
                        )}
                        {e.photos.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              <Camera className="h-3.5 w-3.5" /> {t("photoEvidence")}
                            </p>
                            <PhotoThumbs photos={e.photos} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("notCompleted")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
