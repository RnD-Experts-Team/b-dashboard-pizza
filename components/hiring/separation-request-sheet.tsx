"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  User,
  CalendarDays,
  FileText,
  ShieldCheck,
  Paperclip,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { separationService } from "@/lib/api/services/separation.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { StoreRequest } from "@/types/hiring.types";

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

function AttachmentThumb({ url }: { url: string }) {
  const isImg = IMAGE_EXTS.test(url.split("?")[0]);
  if (isImg) {
    return (
      <img
        src={url}
        alt="attachment"
        className="h-16 w-16 rounded object-cover shrink-0"
      />
    );
  }
  return (
    <div className="h-16 w-16 rounded bg-muted flex items-center justify-center shrink-0">
      <FileText className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "â€”"}</span>
    </div>
  );
}

interface SeparationRequestSheetProps {
  request: StoreRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SeparationRequestSheet({
  request,
  open,
  onOpenChange,
  onSuccess,
}: SeparationRequestSheetProps) {
  const sep = request?.separation_request ?? null;
  const emp = sep?.employee ?? null;
  const employeeName = emp
    ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(" ")
    : null;
  const rowStoreNumber = sep?.store?.store_number ?? "";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const effectiveStoreId = overviewStores?.[0]?.id;
  const canSubmitDecision = canAccessRoute({ service: "Hiring", method: "POST", path: "/v1/stores/*/separation-requests/*/decision", storeId: effectiveStoreId });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Separation Request #{request?.id}</SheetTitle>
          <SheetDescription>Details of the selected separation request.</SheetDescription>
        </SheetHeader>

        {request && sep && (
          <div className="space-y-6 p-4 text-sm">
            {/* â”€â”€ Overview â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle icon={CalendarDays} label="Overview" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow
                  label="Date of Request"
                  value={
                    request.requested_at
                      ? new Date(request.requested_at).toLocaleDateString()
                      : "â€”"
                  }
                />
                <DetailRow
                  label="Final Working Day"
                  value={
                    sep.final_working_day
                      ? new Date(sep.final_working_day).toLocaleDateString()
                      : "â€”"
                  }
                />
                <DetailRow
                  label="Separation Type"
                  value={
                    <Badge
                      variant={
                        sep.separation_type === "termination"
                          ? "destructive"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {sep.separation_type}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Status"
                  value={<Badge variant="secondary" className="capitalize">{request.workflow_status}</Badge>}
                />
                {sep.resignation_reason && (
                  <DetailRow
                    label="Resignation Reason"
                    value={
                      <span className="capitalize">
                        {sep.resignation_reason.replace(/_/g, " ")}
                      </span>
                    }
                  />
                )}
                {sep.resignation_reason_details && (
                  <div className="col-span-2">
                    <DetailRow
                      label="Resignation Details"
                      value={sep.resignation_reason_details}
                    />
                  </div>
                )}
                {sep.termination_reason && (
                  <DetailRow
                    label="Termination Reason"
                    value={
                      <span className="capitalize">
                        {sep.termination_reason.replace(/_/g, " ")}
                      </span>
                    }
                  />
                )}
                {sep.termination_reason_details && (
                  <div className="col-span-2">
                    <DetailRow
                      label="Termination Details"
                      value={sep.termination_reason_details}
                    />
                  </div>
                )}
                {sep.termination_letter && (
                  <div className="col-span-2">
                    <DetailRow label="Termination Letter" value={sep.termination_letter} />
                  </div>
                )}
                {sep.additional_notes && (
                  <div className="col-span-2">
                    <DetailRow label="Additional Notes" value={sep.additional_notes} />
                  </div>
                )}
              </div>
            </section>

            {/* â”€â”€ Employee â”€â”€ */}
            {emp && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={User} label="Employee" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Name" value={employeeName} />
                    <DetailRow label="Gender" value={emp.gender} />
                    <DetailRow label="Employment Type" value={emp.employment_type} />
                  </div>
                </section>
              </>
            )}

            {/* â”€â”€ Requested By â”€â”€ */}
            {sep.user && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={User} label="Requested By" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Name" value={sep.user.name} />
                    <DetailRow label="Email" value={sep.user.email} />
                  </div>
                </section>
              </>
            )}

            {/* â”€â”€ Attachments â”€â”€ */}
            {sep.attachments.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle
                    icon={Paperclip}
                    label={`Attachments (${sep.attachments.length})`}
                  />
                  <div className="space-y-2">
                    {sep.attachments.map((att) => (
                      <div key={att.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <AttachmentThumb url={att.attachment_url ?? att.file_path} />
                          <div className="flex-1 min-w-0 space-y-1">
                            <a
                              href={att.attachment_url ?? att.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline truncate"
                            >
                              {att.original_name || `Attachment #${att.id}`}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <p className="text-xs text-muted-foreground">
                              {(att.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* â”€â”€ Latest Decision â”€â”€ */}
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
                      value={new Date(
                        request.latest_decision.decided_at,
                      ).toLocaleDateString()}
                    />
                  </div>
                </section>
              </>
            )}

            {/* ── Supervisor Decision (pending) ── */}
            {!request.latest_decision && canSubmitDecision && (
              <>
                <Separator />
                <SupervisorDecisionSection
                  separationId={sep.id}
                  storeId={rowStoreNumber}
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

/* -- Approve / Reject Decision Sub-component -- */
function SupervisorDecisionSection({
  separationId,
  storeId,
  onSuccess,
}: {
  separationId: number;
  storeId: string;
  onSuccess: () => void;
}) {
  const [decision, setDecision] = useState<"completed" | "rejected" | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (decision === null || !storeId) return;
    setIsSubmitting(true);

    try {
      await separationService.submitSeparationDecision(
        storeId,
        separationId,
        {
          decision,
          notes: notes.trim() || null,
        },
      );
      toast.success("Decision submitted.");
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
      <SectionTitle icon={ShieldCheck} label="Approve / Reject" />

      <div className="flex gap-2">
        <Button
          variant={decision === "completed" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setDecision("completed")}
          type="button"
        >
          Approve
        </Button>
        <Button
          variant={decision === "rejected" ? "destructive" : "outline"}
          className="flex-1"
          onClick={() => setDecision("rejected")}
          type="button"
        >
          Reject
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="decision_notes">Notes</Label>
        <Textarea
          id="decision_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          maxLength={2000}
          rows={3}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isSubmitting || decision === null}
      >
        {isSubmitting ? "Submitting..." : "Submit Decision"}
      </Button>
    </section>
  );
}
