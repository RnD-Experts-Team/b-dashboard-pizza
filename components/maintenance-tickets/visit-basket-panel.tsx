"use client";

import { useMemo, useState } from "react";
import { Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useVisitBasketStore } from "@/lib/store/visit-basket.store";
import {
  AttendanceFields,
  EMPTY_ATTENDANCE_FORM,
  buildAttendancePayload,
  type AttendanceFormValue,
} from "./attendance-panel";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";

/**
 * Logs one visit across everything collected.
 *
 * This is what the Log visit button became. That button opened a dialog with
 * its own issue picker, so recording a trip meant leaving the ticket you were
 * on, then finding the same issues again in a list from memory. Collecting them
 * where you come across them is the same job with the searching taken out.
 *
 * One request to the GLOBAL attendance endpoint, which accepts issues across
 * any number of tickets -- that is what makes a real trip recordable at all.
 *
 * Renders nothing when the basket is empty.
 */

interface VisitBasketPanelProps {
  technicians: CatalogTechnician[];
  onLogged?: () => void;
  className?: string;
}

export function VisitBasketPanel({ technicians, onLogged, className }: VisitBasketPanelProps) {
  const items = useVisitBasketStore((s) => s.items);
  const remove = useVisitBasketStore((s) => s.remove);
  const clear = useVisitBasketStore((s) => s.clear);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AttendanceFormValue>(EMPTY_ATTENDANCE_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      const key = item.storeId ?? `other:${item.otherStore ?? ""}`;
      if (!seen.has(key)) seen.set(key, item.storeId ?? item.otherStore ?? "—");
    }
    return Array.from(seen.values());
  }, [items]);

  const tickets = useMemo(
    () => Array.from(new Set(items.map((i) => i.ticketId))),
    [items]
  );

  if (items.length === 0) return null;

  /**
   * More than one store is not a refusal -- upstream will accept it -- but it
   * is almost always a mistake, because the hours land as one store's expense.
   * Said before it happens, not discovered afterwards.
   */
  const spansStores = stores.length > 1;

  async function handleSubmit() {
    if (!form.technicianId) {
      toast.error("Say who the visit was by first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { payload, topLevelFiles } = buildAttendancePayload(
        form,
        items.map((i) => i.issueId),
        files
      );
      await maintenanceTicketsService.createAttendanceEntryGlobal(payload, topLevelFiles);

      toast.success(
        `Logged across ${items.length === 1 ? "1 job" : `${items.length} jobs`}.`
      );
      clear();
      setForm(EMPTY_ATTENDANCE_FORM);
      setFiles([]);
      setOpen(false);
      onLogged?.();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        // Its own identity -- a third accent, so it is never mistaken for the
        // work basket or the pay basket.
        "rounded-xl border border-s-2 border-s-[var(--color-chart-2)] bg-card p-3 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--color-chart-2)]" aria-hidden="true" />
        <span className="text-sm font-medium">
          {items.length === 1 ? "1 job on this visit" : `${items.length} jobs on this visit`}
        </span>
        <span className="text-xs text-muted-foreground">
          across {tickets.length === 1 ? "1 ticket" : `${tickets.length} tickets`}
        </span>

        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" variant={open ? "default" : "outline"} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Log the hours"}
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={isSubmitting}>
            Empty
          </Button>
        </div>
      </div>

      {spansStores && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
          These are at {stores.length} different stores. One visit records hours against one
          store, so this would put all of it on whichever the issues belong to — usually you want
          a separate visit per store.
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
            <button
              type="button"
              onClick={() => remove(item.issueId)}
              aria-label={`Take ${item.title} off this visit`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {open && (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <AttendanceFields
            value={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            technicians={technicians}
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
          />
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              Log it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
