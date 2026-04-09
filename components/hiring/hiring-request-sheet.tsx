"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, User, UserPlus, Building2, CalendarDays, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { HiringRequestRecord, SupervisorDecisionPayload } from "@/types/hiring.types";

const AVAILABILITY_LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekends: "Weekends",
  open_availability: "Open Availability",
};

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const variant =
    lower === "approved"
      ? "default"
      : lower === "rejected"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize text-xs">
      {status}
    </Badge>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4 pt-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

interface HiringRequestSheetProps {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HiringRequestSheet({
  requestId,
  open,
  onOpenChange,
  onSuccess,
}: HiringRequestSheetProps) {
  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<HiringRequestRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || requestId === null || !selectedStore?.storeId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    hiringService
      .getHiringRequest(selectedStore.storeId, requestId)
      .then((record) => {
        if (!cancelled) setData(record);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load request details.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, requestId, selectedStore?.storeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Hiring Request #{requestId}</SheetTitle>
          <SheetDescription>Full details of the selected hiring request.</SheetDescription>
        </SheetHeader>

        {isLoading && <SheetSkeleton />}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-6 p-4 text-sm">
            {/* ── Overview ── */}
            <section className="space-y-3">
              <SectionTitle icon={CalendarDays} label="Overview" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Date of Request" value={data.date_of_request} />
                <DetailRow label="Desired Start Date" value={data.desired_start_date} />
                <DetailRow
                  label="Created"
                  value={new Date(data.created_at).toLocaleDateString()}
                />
                <DetailRow
                  label="Updated"
                  value={new Date(data.updated_at).toLocaleDateString()}
                />
              </div>
            </section>

            <Separator />

            {/* ── Store & Manager ── */}
            <section className="space-y-3">
              <SectionTitle icon={Building2} label="Store &amp; Manager" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Store" value={data.store.name} />
                <DetailRow label="Store Number" value={data.store.store_number} />
                <DetailRow label="Manager" value={data.store_manager.name} />
                <DetailRow label="Manager Email" value={data.store_manager.email} />
              </div>
            </section>

            <Separator />

            {/* ── Candidates ── */}
            <section className="space-y-3">
              <SectionTitle icon={User} label={`Candidates (${data.candidates.length})`} />
              {data.candidates.length === 0 ? (
                <p className="text-muted-foreground text-xs">No candidates.</p>
              ) : (
                <div className="space-y-3">
                  {data.candidates.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <StatusBadge status={c.approve_status} />
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                        <span>{c.email}</span>
                        <span>{c.contact_number}</span>
                        {c.notes && (
                          <span className="italic text-foreground/70">
                            Note: {c.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* ── New Hires ── */}
            <section className="space-y-3">
              <SectionTitle icon={UserPlus} label={`Positions (${data.new_hires.length})`} />
              {data.new_hires.length === 0 ? (
                <p className="text-muted-foreground text-xs">No positions.</p>
              ) : (
                <div className="space-y-3">
                  {data.new_hires.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {h.shift?.shift ?? `Shift ${h.shift_id}`}
                        </span>
                        <StatusBadge status={h.approved_status} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {AVAILABILITY_LABELS[h.availability_needed] ?? h.availability_needed}
                        </Badge>
                      </div>
                      {h.notes && (
                        <p className="text-xs italic text-foreground/70">
                          Note: {h.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* ── Supervisor Decision ── */}
            {data.supervisor_approve ? (
              <SupervisorDecisionDetails data={data} />
            ) : (
              <SupervisorDecisionSection
                data={data}
                onSuccess={() => {
                  onSuccess?.();
                  onOpenChange(false);
                }}
              />
            )}

            {/* ── Hiring Review ── */}
            {data.hiring_review && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={ShieldCheck} label="Hiring Review" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow
                      label="Completed"
                      value={
                        <Badge variant={data.hiring_review.is_completed ? "default" : "secondary"}>
                          {data.hiring_review.is_completed ? "Yes" : "No"}
                        </Badge>
                      }
                    />
                    <DetailRow
                      label="Reviewed By"
                      value={data.hiring_review.reviewed_by?.name ?? "—"}
                    />
                    <DetailRow label="Date" value={data.hiring_review.date_of_request} />
                    <DetailRow label="Notes" value={data.hiring_review.notes ?? "—"} />
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Supervisor Decision Details (read-only) ── */
function SupervisorDecisionDetails({ data }: { data: HiringRequestRecord }) {
  const sa = data.supervisor_approve!;
  return (
    <>
      <Separator />
      <section className="space-y-3">
        <SectionTitle icon={ShieldCheck} label="Supervisor Decision" />
        <div className="grid grid-cols-2 gap-3">
          <DetailRow
            label="Overall Status"
            value={
              <Badge variant={sa.approve_status ? "default" : "destructive"}>
                {sa.approve_status ? "Approved" : "Rejected"}
              </Badge>
            }
          />
          <DetailRow
            label="Approved By"
            value={sa.approved_by?.name ?? "—"}
          />
          <DetailRow label="Notes" value={sa.notes ?? "—"} />
          <DetailRow
            label="Date"
            value={new Date(sa.created_at).toLocaleDateString()}
          />
        </div>

        {/* Individual candidate statuses */}
        {data.candidates.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">Candidates</p>
            {data.candidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
              >
                <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                <StatusBadge status={c.approve_status} />
              </div>
            ))}
          </div>
        )}

        {/* Individual new-hire statuses */}
        {data.new_hires.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">Positions</p>
            {data.new_hires.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
              >
                <span className="text-sm flex-1 min-w-0 truncate">
                  {h.shift?.shift ?? `Shift ${h.shift_id}`}
                </span>
                <StatusBadge status={h.approved_status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ── Supervisor Decision Sub-component ── */
function SupervisorDecisionSection({
  data,
  onSuccess,
}: {
  data: HiringRequestRecord;
  onSuccess: () => void;
}) {
  const { selectedStore } = useSelectedStoreStore();

  const [approveAll, setApproveAll] = useState<"approved" | "rejected" | undefined>(undefined);
  const [candidateStatuses, setCandidateStatuses] = useState<
    Record<number, "approved" | "rejected" | undefined>
  >({});
  const [hireStatuses, setHireStatuses] = useState<
    Record<number, "approved" | "rejected" | undefined>
  >({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Reset selections when data changes */
  useEffect(() => {
    setCandidateStatuses({});
    setHireStatuses({});
    setApproveAll(undefined);
    setNotes("");
  }, [data.id]);

  const allSelected =
    approveAll !== undefined &&
    data.candidates.every((c) => candidateStatuses[c.id] !== undefined) &&
    data.new_hires.every((h) => hireStatuses[h.id] !== undefined);

  async function handleSubmit() {
    if (!selectedStore?.storeId || !allSelected) return;
    setIsSubmitting(true);

    const payload: SupervisorDecisionPayload = {
      approve_status: approveAll === "approved",
      candidates: data.candidates.map((c) => ({
        id: c.id,
        status: candidateStatuses[c.id] as "approved" | "rejected",
      })),
      new_hires: data.new_hires.map((h) => ({
        id: h.id,
        status: hireStatuses[h.id] as "approved" | "rejected",
      })),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      await hiringService.submitSupervisorDecision(
        selectedStore.storeId,
        data.id,
        payload,
      );
      toast.success("Supervisor decision submitted.");
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit decision.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <SectionTitle icon={ShieldCheck} label="Supervisor Decision" />

      {/* Overall approval */}
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm font-medium">Overall Decision</span>
        <Select
          value={approveAll ?? ""}
          onValueChange={(v) =>
            setApproveAll(v as "approved" | "rejected")
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approved">Approve</SelectItem>
            <SelectItem value="rejected">Reject</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Candidate decisions */}
      {data.candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Candidates</p>
          {data.candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
            >
              <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
              <Select
                value={candidateStatuses[c.id] ?? ""}
                onValueChange={(v) =>
                  setCandidateStatuses((prev) => ({
                    ...prev,
                    [c.id]: v as "approved" | "rejected",
                  }))
                }
              >
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {/* New hire decisions */}
      {data.new_hires.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Positions</p>
          {data.new_hires.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
            >
              <span className="text-sm flex-1 min-w-0 truncate">
                {h.shift?.shift ?? `Shift ${h.shift_id}`}
              </span>
              <Select
                value={hireStatuses[h.id] ?? ""}
                onValueChange={(v) =>
                  setHireStatuses((prev) => ({
                    ...prev,
                    [h.id]: v as "approved" | "rejected",
                  }))
                }
              >
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="supervisor_decision_notes">Notes</Label>
        <Textarea
          id="supervisor_decision_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
          maxLength={255}
          rows={3}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isSubmitting || !allSelected}
      >
        {isSubmitting ? "Submitting…" : "Submit Decision"}
      </Button>
    </section>
  );
}
