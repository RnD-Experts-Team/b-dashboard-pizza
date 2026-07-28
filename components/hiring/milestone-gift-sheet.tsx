"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  CalendarDays,
  Gift,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import type { StoreRequest } from "@/types/hiring.types";
import type {
  Milestone,
  MilestoneGiftStage,
  MilestoneGiftFinalStatus,
} from "@/types/milestone-gift.types";

const MILESTONE_LABELS: Record<Milestone, string> = {
  "8_days": "8 Days",
  "14_days": "14 Days",
  "1_month": "1 Month",
  "2_months": "2 Months",
  "3_months": "3 Months",
  "4_months": "4 Months",
  "5_months": "5 Months",
  "6_months": "6 Months",
  "8_months": "8 Months",
  "1_year": "1 Year",
  other: "Other",
};

const STAGE_LABELS: Record<MilestoneGiftStage, string> = {
  created: "Submitted",
  rating: "Rated",
  gift_decision: "Decided",
  final_status: "Finalized",
  closed: "Closed",
  cancelled: "Cancelled",
};

const FINAL_STATUS_LABELS: Record<MilestoneGiftFinalStatus, string> = {
  delivered_to_employee: "Delivered to Employee",
  sent_to_store_awaiting_pickup: "Sent to Store — Awaiting Pickup",
  not_delivered_no_longer_with_company: "Not Delivered — Employee Left",
  not_delivered_other_reason: "Not Delivered — Other Reason",
};

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
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

interface MilestoneGiftSheetProps {
  request: StoreRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MilestoneGiftSheet({
  request,
  open,
  onOpenChange,
}: MilestoneGiftSheetProps) {
  const mg = request?.milestone_gift_request ?? null;
  const emp = mg?.employee ?? null;
  const employeeName = emp
    ? [emp.first_name, emp.middle_name, emp.last_name]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Milestone Gift Request #{request?.id}</SheetTitle>
          <SheetDescription>
            Details of the selected milestone gift request.
          </SheetDescription>
        </SheetHeader>

        {request && mg && (
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
                  label="Milestone"
                  value={
                    <Badge variant="secondary">
                      {MILESTONE_LABELS[mg.milestone] ?? mg.milestone}
                    </Badge>
                  }
                />
                {mg.milestone === "other" && mg.milestone_other && (
                  <div className="col-span-2">
                    <DetailRow
                      label="Milestone Detail"
                      value={mg.milestone_other}
                    />
                  </div>
                )}
                <DetailRow
                  label="Stage"
                  value={
                    <Badge variant="secondary" className="capitalize">
                      {STAGE_LABELS[mg.stage] ?? mg.stage}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    <Badge variant="secondary" className="capitalize">
                      {request.workflow_status}
                    </Badge>
                  }
                />
              </div>
            </section>

            {/* ── Employee ── */}
            {emp && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={User} label="Employee" />
                  <DetailRow label="Name" value={employeeName} />
                </section>
              </>
            )}

            {/* ── Requested By ── */}
            {mg.user && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={User} label="Requested By" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Name" value={mg.user.name} />
                    {mg.user.email && (
                      <DetailRow label="Email" value={mg.user.email} />
                    )}
                  </div>
                </section>
              </>
            )}

            {/* ── Rating ── */}
            {mg.rating && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={ClipboardList} label="Rating" />
                  <div className="space-y-2">
                    {mg.rating.answers.map((ans) => (
                      <div
                        key={ans.id}
                        className="rounded-md border p-3 space-y-1.5"
                      >
                        <p className="text-sm font-medium">
                          {ans.question?.question_text ??
                            `Question #${ans.milestone_gift_question_id}`}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ans.selected_options.length > 0 ? (
                            ans.selected_options.map((so) => (
                              <Badge key={so.id} variant="outline">
                                {so.question_option.option_text}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {mg.rating.additional_comments && (
                      <DetailRow
                        label="Additional Comments"
                        value={mg.rating.additional_comments}
                      />
                    )}
                  </div>
                </section>
              </>
            )}

            {/* ── Gift Decision ── */}
            {mg.decision && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={Gift} label="Gift Decision" />
                  {mg.decision.is_cancelled ? (
                    <div className="grid grid-cols-1 gap-3">
                      <DetailRow
                        label="Decision"
                        value={
                          <Badge variant="destructive">Cancelled</Badge>
                        }
                      />
                      <DetailRow
                        label="Cancellation Reason"
                        value={mg.decision.cancellation_reason}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow
                        label="Gift"
                        value={mg.decision.gift_description}
                      />
                      <DetailRow
                        label="Cost"
                        value={
                          mg.decision.gift_cost != null
                            ? `$${Number(mg.decision.gift_cost).toFixed(2)}`
                            : "—"
                        }
                      />
                      <DetailRow
                        label="Delivery Date"
                        value={
                          mg.decision.delivery_date
                            ? new Date(
                                mg.decision.delivery_date,
                              ).toLocaleDateString()
                            : "—"
                        }
                      />
                      <DetailRow
                        label="Sent to Store"
                        value={mg.decision.sent_to_store ? "Yes" : "No"}
                      />
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ── Final Status ── */}
            {mg.final_status && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={PackageCheck} label="Final Status" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow
                      label="Status"
                      value={
                        <Badge variant="secondary">
                          {FINAL_STATUS_LABELS[mg.final_status.status] ??
                            mg.final_status.status}
                        </Badge>
                      }
                    />
                    <DetailRow
                      label="Confirmation Date"
                      value={
                        mg.final_status.confirmation_date
                          ? new Date(
                              mg.final_status.confirmation_date,
                            ).toLocaleDateString()
                          : "—"
                      }
                    />
                    {mg.final_status.status_other_reason && (
                      <div className="col-span-2">
                        <DetailRow
                          label="Reason"
                          value={mg.final_status.status_other_reason}
                        />
                      </div>
                    )}
                    {mg.final_status.closing_notes && (
                      <div className="col-span-2">
                        <DetailRow
                          label="Closing Notes"
                          value={mg.final_status.closing_notes}
                        />
                      </div>
                    )}
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
