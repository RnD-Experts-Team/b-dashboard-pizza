"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, UserPlus, CalendarDays, Clock, ClipboardList, CheckCheck, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { StoreRequest, StoreRequestEmployee } from "@/types/hiring.types";

const AVAILABILITY_LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekends: "Weekends",
  weekend: "Weekends",
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
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

interface HiringRequestSheetProps {
  request: StoreRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HiringRequestSheet({
  request,
  open,
  onOpenChange,
  onSuccess,
}: HiringRequestSheetProps) {
  const hr = request?.hiring_request ?? null;
  const { selectedStore } = useSelectedStoreStore();
  const [employees, setEmployees] = useState<StoreRequestEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setEmployeesLoading(true);
    const controller = new AbortController();
    hiringService
      .getStoreEmployees(selectedStore.storeId, controller.signal)
      .then((list) => { if (!cancelled) setEmployees(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmployeesLoading(false); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, selectedStore?.storeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Hiring Request #{request?.id}</SheetTitle>
          <SheetDescription>Full details of the selected hiring request.</SheetDescription>
        </SheetHeader>

        {request && hr && (
          <div className="space-y-6 p-4 text-sm">
            {/* ── Overview ── */}
            <section className="space-y-3">
              <SectionTitle icon={CalendarDays} label="Overview" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow
                  label="Date of Request"
                  value={
                    request.requested_at
                      ? new Date(request.requested_at).toLocaleDateString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Desired Start Date"
                  value={
                    hr.desired_start_date
                      ? new Date(hr.desired_start_date).toLocaleDateString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge status={request.workflow_status} />}
                />
                <DetailRow label="Employees Needed" value={hr.employees_needed} />
                {hr.final_notes && (
                  <div className="col-span-2">
                    <DetailRow label="Notes" value={hr.final_notes} />
                  </div>
                )}
              </div>
            </section>

            {/* ── Requested By ── */}
            {hr.user && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={UserPlus} label="Requested By" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Name" value={hr.user.name} />
                    <DetailRow label="Email" value={hr.user.email} />
                  </div>
                </section>
              </>
            )}

            {/* ── Candidates ── */}
            <Separator />
            <section className="space-y-3">
              <SectionTitle icon={User} label={`Candidates (${hr.candidates.length})`} />
              {hr.candidates.length === 0 ? (
                <p className="text-muted-foreground text-xs">No candidates.</p>
              ) : (
                <div className="space-y-2">
                  {hr.candidates.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3 space-y-1">
                      <span className="font-medium">{c.name}</span>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>{c.email}</p>
                        {c.phone && <p>{c.phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Positions ── */}
            <Separator />
            <section className="space-y-3">
              <SectionTitle icon={UserPlus} label={`Positions (${hr.positions.length})`} />
              {hr.positions.length === 0 ? (
                <p className="text-muted-foreground text-xs">No positions.</p>
              ) : (
                <div className="space-y-2">
                  {hr.positions.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {p.shift_type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {AVAILABILITY_LABELS[p.availability_type] ?? p.availability_type}
                        </Badge>
                      </div>
                      {p.notes && (
                        <p className="text-xs italic text-foreground/70">Note: {p.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Latest Decision ── */}
            {request.latest_decision && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={ClipboardList} label="Latest Decision" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow
                      label="Decision"
                      value={
                        <span className="capitalize font-medium">
                          {request.latest_decision.decision}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Date"
                      value={new Date(request.latest_decision.decided_at).toLocaleDateString()}
                    />
                    {request.latest_decision.number_hired != null && (
                      <DetailRow
                        label="Number Hired"
                        value={request.latest_decision.number_hired}
                      />
                    )}
                    {request.latest_decision.completed_at && (
                      <DetailRow
                        label="Completed At"
                        value={new Date(
                          request.latest_decision.completed_at,
                        ).toLocaleDateString()}
                      />
                    )}
                  </div>
                </section>
              </>
            )}

            {/* ── Complete Hiring (pending) ── */}
            {!request.latest_decision && (
              <>
                <Separator />
                <CompleteHiringSection
                  hiringRequestId={hr.id}
                  employeesNeeded={hr.employees_needed ?? 1}
                  employees={employees}
                  employeesLoading={employeesLoading}
                  onSuccess={() => {
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Complete Hiring Sub-component ── */
function CompleteHiringSection({
  hiringRequestId,
  employeesNeeded,
  employees,
  employeesLoading,
  onSuccess,
}: {
  hiringRequestId: number;
  employeesNeeded: number;
  employees: StoreRequestEmployee[];
  employeesLoading: boolean;
  onSuccess: () => void;
}) {
  const { selectedStore } = useSelectedStoreStore();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = query.trim()
    ? employees.filter((emp) =>
        `${emp.first_name} ${emp.last_name}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : employees;

  function toggleEmployee(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= employeesNeeded) return prev; // cap at needed
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!selectedStore?.storeId) return;
    setIsSubmitting(true);
    try {
      await hiringService.submitHiringDecision(selectedStore.storeId, hiringRequestId, {
        employee_ids: ids,
        number_hired: ids.length,
      });
      toast.success("Hiring completed.");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete hiring.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <SectionTitle icon={CheckCheck} label="Complete Hiring" />

      <div className="space-y-2">
        <Label>
          Select Employees{" "}
          <span className="text-muted-foreground font-normal">
            ({selectedIds.size} / {employeesNeeded} needed)
          </span>
        </Label>

        {/* Search bar — same style as Employees page */}
        {!employeesLoading && employees.length > 0 && (
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="ps-9"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {employeesLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading employees…
          </div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No employees found.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No employees match your search.</p>
            ) : (
              filtered.map((emp) => {
                const isSelected = selectedIds.has(emp.id);
                const atCap = selectedIds.size >= employeesNeeded;
                return (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 ${
                      !isSelected && atCap ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                      disabled={!isSelected && atCap}
                    />
                    <span className="text-sm">
                      {emp.first_name} {emp.last_name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isSubmitting || selectedIds.size === 0}
      >
        {isSubmitting ? "Submitting…" : "Complete Hiring"}
      </Button>
    </section>
  );
}
