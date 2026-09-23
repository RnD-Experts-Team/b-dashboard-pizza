"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, History, PackageCheck, Pencil, ShoppingCart, XCircle } from "lucide-react";
import {
  SHIRT_SOURCE_LABELS,
  formatInstant,
  formatPlainDate,
  milestoneMonthLabel,
  shirtActionsFor,
  shirtActorName,
  shirtEmployeeName,
} from "@/lib/shirts/shirt-utils";
import type { ShirtAction } from "@/lib/shirts/shirt-utils";
import { ShirtPreview } from "@/components/shirts/shirt-preview";
import {
  ColorSwatch,
  DetailRow,
  SectionTitle,
  ShirtStatusBadge,
} from "@/components/shirts/shirt-ui";
import type { ShirtMilestone } from "@/types/shirt-milestone.types";

const ACTION_LABEL: Record<ShirtAction, string> = {
  entry: "Fill Entry",
  order: "Order",
  reschedule: "Change Date",
  deliver: "Mark Delivered",
  cancel: "Cancel",
};

const ACTION_ICON: Record<ShirtAction, React.ComponentType<{ className?: string }>> = {
  entry: Pencil,
  order: ShoppingCart,
  reschedule: CalendarClock,
  deliver: PackageCheck,
  cancel: XCircle,
};

export interface ShirtMilestoneSheetProps {
  milestone: ShirtMilestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perms: { canFill: boolean; canFulfil: boolean };
  onAction: (action: ShirtAction, milestone: ShirtMilestone) => void;
  onViewHistory: (milestone: ShirtMilestone) => void;
}

/**
 * Read-only detail plus the status-driven actions. The footer buttons come
 * from the same shirtActionsFor() the queues use, so a row menu and this sheet
 * can never disagree about what is possible.
 */
export function ShirtMilestoneSheet({
  milestone,
  open,
  onOpenChange,
  perms,
  onAction,
  onViewHistory,
}: ShirtMilestoneSheetProps) {
  const actions = milestone ? shirtActionsFor(milestone.status, perms) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Shirt Milestone{milestone ? ` #${milestone.id}` : ""}
          </SheetTitle>
          <SheetDescription>
            {milestone ? shirtEmployeeName(milestone.employee) : ""}
          </SheetDescription>
        </SheetHeader>

        {milestone && (
          <div className="flex flex-col gap-2 px-4 pb-6">
            <div className="mx-auto w-40">
              {/* Snapshot, not the live catalog — what was actually ordered. */}
              <ShirtPreview
                template={milestone.shirt_template}
                color={milestone.shirt_color}
                logo={milestone.shirt_logo}
              />
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <ShirtStatusBadge status={milestone.status} />
              <Badge variant="outline">
                {SHIRT_SOURCE_LABELS[milestone.source] ?? milestone.source}
              </Badge>
            </div>

            <SectionTitle>Milestone</SectionTitle>
            <DetailRow label="Employee">
              {shirtEmployeeName(milestone.employee)}
            </DetailRow>
            <DetailRow label="Store">{milestone.store?.store_number ?? "—"}</DetailRow>
            <DetailRow label="Month">
              {milestoneMonthLabel(milestone.milestone_month)}
            </DetailRow>
            <DetailRow label="Stint started">
              {formatPlainDate(milestone.stint_start_date)}
            </DetailRow>
            <DetailRow label="Due">{formatPlainDate(milestone.due_date)}</DetailRow>

            <SectionTitle>Shirt</SectionTitle>
            <DetailRow label="Colour">
              <span className="inline-flex items-center gap-2">
                <ColorSwatch
                  hex={milestone.shirt_color?.hex_code}
                  name={milestone.shirt_color?.name}
                />
                {milestone.shirt_color?.name ?? "—"}
              </span>
            </DetailRow>
            <DetailRow label="Logo">{milestone.shirt_logo?.name ?? "—"}</DetailRow>
            <DetailRow label="Template">
              {milestone.shirt_template?.name ?? "—"}
            </DetailRow>
            <DetailRow label="Size">{milestone.t_shirt_size ?? "—"}</DetailRow>
            {milestone.entry_notes && (
              <DetailRow label="Notes">{milestone.entry_notes}</DetailRow>
            )}

            <SectionTitle>Timeline</SectionTitle>
            {/* The *_at fields are real instants, so formatInstant is correct
                here — unlike delivery_date just below, which is a calendar date. */}
            <DetailRow label="Submitted">
              {formatInstant(milestone.submitted_at)}
              {milestone.submitted_by_user && (
                <span className="block text-xs text-muted-foreground">
                  by {shirtActorName(milestone.submitted_by_user)}
                </span>
              )}
            </DetailRow>
            <DetailRow label="Ordered">
              {formatInstant(milestone.ordered_at)}
              {milestone.ordered_by_user && (
                <span className="block text-xs text-muted-foreground">
                  by {shirtActorName(milestone.ordered_by_user)}
                </span>
              )}
            </DetailRow>
            <DetailRow label="Delivery date">
              {formatPlainDate(milestone.delivery_date)}
            </DetailRow>
            <DetailRow label="Delivered">
              {formatInstant(milestone.delivered_at)}
              {milestone.delivered_by_user && (
                <span className="block text-xs text-muted-foreground">
                  by {shirtActorName(milestone.delivered_by_user)}
                </span>
              )}
            </DetailRow>
            {milestone.delivery_notes && (
              <DetailRow label="Delivery notes">{milestone.delivery_notes}</DetailRow>
            )}
            {milestone.status === "cancelled" && (
              <>
                <DetailRow label="Cancelled">
                  {formatInstant(milestone.cancelled_at)}
                  {milestone.cancelled_by_user && (
                    <span className="block text-xs text-muted-foreground">
                      by {shirtActorName(milestone.cancelled_by_user)}
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Reason">
                  {milestone.cancellation_reason ?? "—"}
                </DetailRow>
              </>
            )}

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewHistory(milestone)}
              >
                <History className="me-2 h-4 w-4" />
                Shirt history
              </Button>
              {actions.map((action) => {
                const Icon = ACTION_ICON[action];
                return (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "cancel" ? "destructive" : "default"}
                    onClick={() => onAction(action, milestone)}
                  >
                    <Icon className="me-2 h-4 w-4" />
                    {ACTION_LABEL[action]}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
