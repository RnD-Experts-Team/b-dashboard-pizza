"use client";

import { useMemo, useState } from "react";
import { Clock, Flag, Loader2, ShoppingBasket, UserPlus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useIssueBasketStore } from "@/lib/store/issue-basket.store";
import { usePayBasketStore } from "@/lib/store/pay-basket.store";
import { useVisitBasketStore } from "@/lib/store/visit-basket.store";
import { DatePicker, TimePicker } from "./form-bits";
import type { CatalogTechnician, IssueStatus } from "@/types/maintenance-tickets.types";

/**
 * Acts on everything in the basket at once.
 *
 * Two of these WRITE: booking somebody and moving statuses. Each is a single
 * upstream request covering every issue in the basket, because those endpoints
 * already take many ids -- creating an assignment even flips each issue to
 * `assigned` and records an audit row per issue in the same transaction.
 *
 * The other two MOVE, they do not write: "Pay for these" and "Add to a visit"
 * tip the selection into the pay basket and the visit basket, where each gets
 * finished and reviewed. Money and hours are never written by a button press on
 * a selection -- you see what you are about to record first.
 *
 * Renders nothing when the basket is empty, so it costs no screen space until
 * there is something to do.
 */

type Mode = "assign" | "status" | null;

const BULK_STATUSES: { value: IssueStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

interface IssueBasketBarProps {
  technicians: CatalogTechnician[];
  /** Refetch whatever is on screen after a bulk write. */
  onChanged?: () => void;
  className?: string;
}

export function IssueBasketBar({
  technicians,
  onChanged,
  className,
}: IssueBasketBarProps) {
  const items = useIssueBasketStore((s) => s.items);
  const remove = useIssueBasketStore((s) => s.remove);
  const clear = useIssueBasketStore((s) => s.clear);
  const addToPay = usePayBasketStore((s) => s.add);
  const addToVisit = useVisitBasketStore((s) => s.add);

  const [mode, setMode] = useState<Mode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [techIds, setTechIds] = useState<number[]>([]);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [status, setStatus] = useState<IssueStatus>("complete");

  const stores = useMemo(
    () => Array.from(new Set(items.map((i) => i.storeId))).filter(Boolean),
    [items]
  );
  const tickets = useMemo(
    () => Array.from(new Set(items.map((i) => i.ticketId))),
    [items]
  );

  if (items.length === 0) return null;

  /**
   * Writes go through store-scoped routes, so a basket spanning stores has to
   * be sent one store at a time. Grouping here keeps that invisible to the user
   * while staying honest about it in the toast.
   */
  function groupByStoreAndTicket() {
    const groups = new Map<string, { storeId: string; ticketId: number; issueIds: number[] }>();
    for (const item of items) {
      const key = `${item.storeId}::${item.ticketId}`;
      const existing = groups.get(key);
      if (existing) existing.issueIds.push(item.issueId);
      else groups.set(key, { storeId: item.storeId, ticketId: item.ticketId, issueIds: [item.issueId] });
    }
    return Array.from(groups.values());
  }

  async function runBulk(fn: (g: { storeId: string; ticketId: number; issueIds: number[] }) => Promise<void>, done: string) {
    setIsSubmitting(true);
    try {
      const groups = groupByStoreAndTicket();
      // Sequential, not parallel: every request makes the auth server verify the
      // token, and firing a dozen at once is how you get rate-limited.
      for (const group of groups) {
        await fn(group);
      }
      toast.success(done);
      clear();
      setMode(null);
      onChanged?.();
    } catch (err) {
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError
          ? err.message
          : "Something went wrong. Nothing after the failure was sent."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Tips the selection into the pay basket. The work basket empties, because
   *  the issues have moved on to the next stage rather than being in two
   *  places at once. */
  function sendToPay() {
    for (const item of items) {
      addToPay({
        issueId: item.issueId,
        ticketId: item.ticketId,
        storeId: item.storeId || null,
        otherStore: item.otherStore,
        title: item.title,
        // Forwarded, not reset. Hard-coding null here was why bulk-sent work
        // arrived on the sheet with nobody to pay.
        technicianId: item.technicianId,
        technicianName: item.technicianName,
      });
    }
    toast.success(
      `${items.length === 1 ? "1 job" : `${items.length} jobs`} marked for payment. Finish the sheet on Daily Pay.`
    );
    clear();
  }

  function sendToVisit() {
    for (const item of items) {
      addToVisit({
        issueId: item.issueId,
        ticketId: item.ticketId,
        storeId: item.storeId || null,
        otherStore: item.otherStore,
        title: item.title,
      });
    }
    toast.success(
      `${items.length === 1 ? "1 job" : `${items.length} jobs`} added to the visit. Log the hours when you are ready.`
    );
    clear();
  }

  const canAssign = techIds.length > 0 && Boolean(date);

  // Its own identity, distinct from the pay basket's -- they are different
  // collections doing different jobs and must not look alike.
  return (
    <div
      className={cn(
        "rounded-xl border border-s-2 border-s-[var(--color-chart-3)] bg-card p-3 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShoppingBasket className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">
          {items.length === 1 ? "1 issue picked up" : `${items.length} issues picked up`}
        </span>
        <span className="text-xs text-muted-foreground">
          across {tickets.length === 1 ? "1 ticket" : `${tickets.length} tickets`}
          {stores.length > 1 && ` and ${stores.length} stores`}
        </span>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={mode === "assign" ? "default" : "outline"}
            onClick={() => setMode(mode === "assign" ? null : "assign")}
            disabled={isSubmitting}
          >
            <UserPlus className="me-1.5 h-3.5 w-3.5" />
            Book a technician
          </Button>
          <Button
            size="sm"
            variant={mode === "status" ? "default" : "outline"}
            onClick={() => setMode(mode === "status" ? null : "status")}
            disabled={isSubmitting}
          >
            <Flag className="me-1.5 h-3.5 w-3.5" />
            Change the status
          </Button>
          {/* These two hand the selection to another basket rather than
              writing anything. The work basket is a transient selection; the
              other two are staging areas you review before committing. */}
          <Button size="sm" variant="outline" onClick={sendToPay} disabled={isSubmitting}>
            <Wallet className="me-1.5 h-3.5 w-3.5" />
            Pay for these
          </Button>
          <Button size="sm" variant="outline" onClick={sendToVisit} disabled={isSubmitting}>
            <Clock className="me-1.5 h-3.5 w-3.5" />
            Add to a visit
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={isSubmitting}>
            Empty
          </Button>
        </div>
      </div>

      {/* The contents, always visible. A basket you cannot see into is a basket
          you do not trust. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.issueId}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px]"
          >
            <span className="text-muted-foreground tabular-nums">#{item.ticketId}</span>
            <span className="max-w-40 truncate">{item.title}</span>
            <button
              type="button"
              onClick={() => remove(item.issueId)}
              aria-label={`Take ${item.title} out of the basket`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {mode === "assign" && (
        <div className="mt-3 space-y-2 rounded-lg border bg-card p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Who is going</Label>
              <Select
                value={techIds[0] != null ? String(techIds[0]) : ""}
                onValueChange={(v) => setTechIds(v ? [Number(v)] : [])}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Pick a technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={String(tech.id)}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">What day</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">What time (optional)</Label>
              <TimePicker value={hour} onChange={setHour} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This books them for every issue in the basket and marks each one assigned.
          </p>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!canAssign || isSubmitting}
              onClick={() =>
                runBulk(
                  (g) =>
                    maintenanceTicketsService.assignIssues(g.storeId, g.ticketId, {
                      ticket_issue_ids: g.issueIds,
                      technician_ids: techIds,
                      assigned_date: date,
                      ...(hour ? { assigned_hour: hour } : {}),
                    }),
                  `Booked for ${items.length} ${items.length === 1 ? "issue" : "issues"}.`
                )
              }
            >
              {isSubmitting && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              Book them
            </Button>
          </div>
        </div>
      )}

      {mode === "status" && (
        <div className="mt-3 space-y-2 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap gap-1.5">
            {BULK_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  status === s.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Waiting, deferred and cancelled are absent on purpose: each needs a
              written reason, and one reason pasted across a dozen issues is not
              a reason. They stay per-issue. */}
          <p className="text-[11px] text-muted-foreground">
            Putting issues on hold, deferring or cancelling needs a reason each, so those stay on
            the issue itself.
          </p>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() =>
                runBulk(
                  (g) =>
                    maintenanceTicketsService.changeIssueStatus(g.storeId, g.ticketId, {
                      ticket_issue_ids: g.issueIds,
                      status,
                    }),
                  `Moved ${items.length} ${items.length === 1 ? "issue" : "issues"}.`
                )
              }
            >
              {isSubmitting && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              Move them
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
