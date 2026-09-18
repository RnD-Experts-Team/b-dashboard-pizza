"use client";

import { useMemo, useState } from "react";
import { Clock, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useVisitBasketStore } from "@/lib/store/visit-basket.store";
import { AttendanceStream } from "./attendance-stream";
import { AttendanceDurationsStrip } from "./attendance-durations-strip";
import {
  EMPTY_ATTENDANCE_FORM,
  FIRST_EVENT_FIELD,
  buildAttendancePayload,
  type AttendanceFormValue,
} from "./attendance-panel";
import type {
  AttendanceEvent,
  AttendanceEventKind,
  CatalogTechnician,
  TicketIssueAttendance,
} from "@/types/maintenance-tickets.types";

/**
 * Logs one visit across everything collected.
 *
 * This is what the Log visit button became. That button opened a dialog with
 * its own issue picker, so recording a trip meant leaving the ticket you were
 * on, then finding the same issues again in a list from memory. Collecting them
 * where you come across them is the same job with the searching taken out.
 *
 * It records against the UNSCOPED attendance endpoints, which accept issues
 * across any number of tickets -- that is what makes a real trip recordable at
 * all, and why the event routes have an unscoped variant too: a visit spanning
 * three tickets has no one ticket whose URL could honestly carry its events.
 *
 * The same event stream as the ticket page, for the same reason: pressing
 * "Clocked in" opens the visit, and every press after it adds to it. There is
 * no save step, and no second way of recording hours to learn.
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
  /** The visit, as the server last described it. Null until the first press
   *  opens one; every write after that replaces it. */
  const [session, setSession] = useState<TicketIssueAttendance | null>(null);

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

  function fail(err: unknown, fallback: string) {
    if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
    toast.error(err instanceof MaintenanceTicketsError ? err.message : fallback);
  }

  /**
   * Record one thing that happened on this visit.
   *
   * The first press OPENS the visit -- one request that both creates it across
   * every job in the basket and records that first event, so there is no window
   * where an empty visit exists because a second call failed. Every press after
   * it appends.
   *
   * The basket is NOT cleared on the first press. A visit is not finished when
   * it starts, and emptying the thing you are still recording into would take
   * the jobs list off screen mid-way through.
   */
  async function record(kind: AttendanceEventKind, at: string) {
    if (!form.technicianId && !session) {
      toast.error("Say who the visit was by first.");
      return;
    }

    try {
      if (!session) {
        const seeded: AttendanceFormValue = { ...form, [FIRST_EVENT_FIELD[kind]]: at };
        const { payload, topLevelFiles } = buildAttendancePayload(
          seeded,
          items.map((i) => i.issueId),
          files
        );
        const created = await maintenanceTicketsService.createAttendanceEntryGlobal(
          payload,
          topLevelFiles
        );

        setSession(created);
        setFiles([]);
        toast.success(
          `Visit started across ${items.length === 1 ? "1 job" : `${items.length} jobs`}.`
        );
        onLogged?.();
        return;
      }

      // Null store and ticket: the unscoped URL. A visit across three tickets
      // has no one ticket its URL could honestly name.
      setSession(
        await maintenanceTicketsService.createAttendanceEvent(null, null, session.id, { kind, at })
      );
      onLogged?.();
    } catch (err) {
      fail(err, "Could not record that.");
    }
  }

  async function correct(event: AttendanceEvent, at: string) {
    if (!session) return;
    try {
      setSession(
        await maintenanceTicketsService.updateAttendanceEvent(null, null, session.id, event.id, at)
      );
      onLogged?.();
    } catch (err) {
      fail(err, "Could not change that.");
    }
  }

  async function strike(event: AttendanceEvent) {
    if (!session) return;
    try {
      setSession(
        await maintenanceTicketsService.markAttendanceEventMistaken(null, null, session.id, event.id)
      );
      toast.success(`${event.label} marked as a mistake. It stays on the record, struck through.`);
      onLogged?.();
    } catch (err) {
      fail(err, "Could not do that.");
    }
  }

  /** Puts the basket away once the visit is written up. The session is on the
   *  server either way -- this only stops the panel following you around. */
  function finish() {
    clear();
    setForm(EMPTY_ATTENDANCE_FORM);
    setFiles([]);
    setSession(null);
    setOpen(false);
    onLogged?.();
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
          {/* Off once a visit is open: the jobs are already attached to it
              server-side, so emptying would only take the list off screen
              while you are still recording into it. "Done with this visit"
              below is how you put it away. */}
          <Button
            size="sm"
            variant="ghost"
            onClick={clear}
            disabled={session !== null}
            title={session ? "Finish the visit below to clear this" : undefined}
          >
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
        <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
          {/* Asked once, before anything is recorded, then it stops being a
              question -- a visit belongs to one technician. */}
          {!session ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Who <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={technicians.map((t) => ({
                  value: String(t.id),
                  label: t.name,
                  hint: t.categoryName ?? undefined,
                }))}
                value={form.technicianId || undefined}
                onChange={(v) => setForm((prev) => ({ ...prev, technicianId: v }))}
                placeholder="Select technician"
                searchPlaceholder="Search technicians…"
                emptyText="No technicians found."
                className="h-9 text-sm"
              />
            </div>
          ) : (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {session.technician?.name ?? `Technician #${session.technicianId}`}
            </p>
          )}

          <AttendanceStream
            events={session?.events ?? []}
            isPaid={session?.payment?.status.value === "paid"}
            onRecord={record}
            onCorrect={correct}
            onStrike={strike}
          />

          {session && <AttendanceDurationsStrip durations={session.durations} />}

          <div className="flex justify-end">
            <Button size="sm" variant={session ? "default" : "ghost"} onClick={finish}>
              {session ? "Done with this visit" : "Cancel"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
