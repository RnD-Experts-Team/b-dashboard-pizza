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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  User,
  CalendarDays,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  MapPin,
  Phone,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { separationService } from "@/lib/api/services/separation.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { SeparationRequestDetail } from "@/types/separation.types";

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

function SheetSkeleton() {
  return (
    <div className="space-y-4 pt-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

interface SeparationRequestSheetProps {
  separationId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SeparationRequestSheet({
  separationId,
  open,
  onOpenChange,
  onSuccess,
}: SeparationRequestSheetProps) {
  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<SeparationRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || separationId === null || !selectedStore?.storeId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    separationService
      .getSeparationRequest(selectedStore.storeId, separationId)
      .then((record) => {
        if (!cancelled) setData(record);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load separation request details.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, separationId, selectedStore?.storeId]);

  const profile = data?.employee?.employee_profile;
  const employeeName = profile
    ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Separation Request #{separationId}</SheetTitle>
          <SheetDescription>Details of the selected separation request.</SheetDescription>
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
                <DetailRow
                  label="Date of Request"
                  value={new Date(data.date_of_request).toLocaleDateString()}
                />
                <DetailRow label="Final Work Date" value={data.final_work_date} />
                <DetailRow
                  label="Separation Type"
                  value={
                    <Badge
                      variant={data.separation_type === "termination" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {data.separation_type}
                    </Badge>
                  }
                />
                <DetailRow label="Other Notes" value={data.other_notes} />
              </div>
              {data.termination_letter && (
                <DetailRow
                  label="Termination Letter"
                  value={data.termination_letter}
                />
              )}
            </section>

            <Separator />

            {/* ── Employee Info ── */}
            <section className="space-y-3">
              <SectionTitle icon={User} label="Employee" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Name" value={employeeName} />
                <DetailRow label="Gender" value={profile?.gender} />
                <DetailRow label="Birth Date" value={profile?.birth_date} />
                <DetailRow label="Employee ID" value={data.employee?.id} />
              </div>
            </section>

            {/* ── Contacts ── */}
            {data.employee?.employeeContacts?.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={Phone} label="Contacts" />
                  <div className="space-y-2">
                    {data.employee.employeeContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border p-2.5"
                      >
                        <span className="text-xs text-muted-foreground capitalize">
                          {c.contact_type}
                        </span>
                        <span className="text-sm">{c.contact_value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ── Addresses ── */}
            {data.employee?.employeeAddresses?.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={MapPin} label="Addresses" />
                  <div className="space-y-2">
                    {data.employee.employeeAddresses.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3 space-y-1 text-sm">
                        <p>{a.address_line_1}</p>
                        {a.address_line_2 && <p>{a.address_line_2}</p>}
                        <p>
                          {a.city}, {a.state} {a.zip_code}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.country}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ── Attachments ── */}
            {data.separationAttachments?.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle
                    icon={Paperclip}
                    label={`Attachments (${data.separationAttachments.length})`}
                  />
                  <div className="space-y-2">
                    {data.separationAttachments.map((att) => (
                      <div key={att.id} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={att.attatchment_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline truncate"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            Attachment #{att.id}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          {att.reason && (
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {att.reason.reason_title}
                            </Badge>
                          )}
                        </div>
                        {att.attatchment_note && (
                          <p className="text-xs text-muted-foreground italic">
                            {att.attatchment_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ── Supervisor Approval ── */}
            {data.supervisor_approve ? (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={ShieldCheck} label="Supervisor Approval" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow
                      label="Status"
                      value={
                        <Badge
                          variant={data.supervisor_approve.accept_status === 1 ? "default" : "destructive"}
                        >
                          {data.supervisor_approve.accept_status === 1 ? "Approved" : "Rejected"}
                        </Badge>
                      }
                    />
                    <DetailRow
                      label="Approved By"
                      value={data.supervisor_approve.approved_by?.name ?? "—"}
                    />
                    <DetailRow label="Notes" value={data.supervisor_approve.notes} />
                    <DetailRow
                      label="Date"
                      value={new Date(data.supervisor_approve.created_at).toLocaleDateString()}
                    />
                  </div>
                </section>
              </>
            ) : (
              <>
                <Separator />
                <SupervisorDecisionSection
                  separationId={data.id}
                  onSuccess={() => {
                    onSuccess?.();
                    onOpenChange(false);
                  }}
                />
              </>
            )}

            {/* ── Hiring Review ── */}
            {data.hiring_review && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={ClipboardCheck} label="Hiring Review" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow
                      label="Completed"
                      value={
                        <Badge
                          variant={data.hiring_review.is_completed === 1 ? "default" : "secondary"}
                        >
                          {data.hiring_review.is_completed === 1 ? "Yes" : "No"}
                        </Badge>
                      }
                    />
                    <DetailRow
                      label="Date"
                      value={new Date(data.hiring_review.date_of_request).toLocaleDateString()}
                    />
                    <DetailRow label="Notes" value={data.hiring_review.notes} />
                  </div>
                </section>
              </>
            )}

            {/* ── Employee Notes ── */}
            {data.employee?.employeeNotes?.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={FileText} label="Employee Notes" />
                  <div className="space-y-2">
                    {data.employee.employeeNotes.map((n) => (
                      <div key={n.id} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm">{n.notes}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
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

/* ── Supervisor Decision Sub-component ── */
function SupervisorDecisionSection({
  separationId,
  onSuccess,
}: {
  separationId: number;
  onSuccess: () => void;
}) {
  const { selectedStore } = useSelectedStoreStore();

  const [acceptStatus, setAcceptStatus] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (acceptStatus === null || !selectedStore?.storeId) return;
    setIsSubmitting(true);

    try {
      await separationService.submitSupervisorDecision(
        selectedStore.storeId,
        separationId,
        {
          accept_status: acceptStatus,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
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

      <div className="flex gap-2">
        <Button
          variant={acceptStatus === true ? "default" : "outline"}
          className="flex-1"
          onClick={() => setAcceptStatus(true)}
          type="button"
        >
          Approve
        </Button>
        <Button
          variant={acceptStatus === false ? "destructive" : "outline"}
          className="flex-1"
          onClick={() => setAcceptStatus(false)}
          type="button"
        >
          Reject
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supervisor_notes">Notes</Label>
        <Textarea
          id="supervisor_notes"
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
        disabled={isSubmitting || acceptStatus === null}
      >
        {isSubmitting ? "Submitting…" : "Submit Decision"}
      </Button>
    </section>
  );
}
