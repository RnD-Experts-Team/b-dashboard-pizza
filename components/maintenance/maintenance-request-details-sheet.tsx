"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { useMaintenanceRequestDetail } from "@/lib/hooks/use-maintenance-request-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import type { MaintenanceRequestDetail } from "@/types/maintenance.types";

const statusConfig: Record<
  string,
  {
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  done: {
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30",
  },
  in_progress: {
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30",
  },
  pending: {
    icon: AlertCircle,
    className:
      "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30",
  },
  cancelled: {
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
  canceled: {
    icon: XCircle,
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30",
  },
};

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusConfig(status: string) {
  return (
    statusConfig[status] ?? {
      icon: AlertCircle,
      className: "",
    }
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM dd, yyyy HH:mm");
}

function formatCurrency(value?: string | null) {
  if (!value) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[11rem_1fr] sm:gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="wrap-break-word font-medium">{value || "—"}</span>
    </div>
  );
}

function MaintenanceRequestDetailsContent({
  detail,
}: {
  detail: MaintenanceRequestDetail;
}) {
  const status = useMemo(() => getStatusConfig(detail.status), [detail.status]);
  const StatusIcon = status.icon;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4">
        <Badge className={cn("gap-1", status.className)}>
          <StatusIcon className="h-3 w-3" />
          {formatStatusLabel(detail.status)}
        </Badge>
        {detail.urgencyLevel && (
          <Badge variant="outline">{detail.urgencyLevel.name}</Badge>
        )}
        <Badge variant="secondary">Entry #{detail.entryNumber ?? "—"}</Badge>
      </div>

      <Separator className="my-3" />

      <ScrollArea className="h-[calc(100vh-15.5rem)] px-4 pb-6 sm:h-[calc(100vh-14rem)]">
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Request
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label="Store" value={detail.store?.name ?? "—"} />
              <DetailRow label="Equipment" value={detail.equipmentWithIssue ?? "—"} />
              <DetailRow
                label="Issue Description"
                value={detail.descriptionOfIssue ?? "—"}
              />
              <DetailRow
                label="Basic Troubleshoot"
                value={detail.basicTroubleshootDone ? "Yes" : "No"}
              />
              <DetailRow
                label="Request Date"
                value={formatDateTime(detail.requestDate)}
              />
              <DetailRow
                label="Submitted At"
                value={formatDateTime(detail.dateSubmitted)}
              />
              <DetailRow label="Due Date" value={formatDateTime(detail.dueDate)} />
              <DetailRow
                label="Task End Date"
                value={formatDateTime(detail.taskEndDate)}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assignment
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label="Assigned To" value={detail.assignedTo?.name ?? "—"} />
              <DetailRow label="Requester" value={detail.requester?.fullName ?? "—"} />
              <DetailRow
                label="Reviewed By"
                value={detail.reviewedByManager?.fullName ?? "—"}
              />
              <DetailRow
                label="Assignment Source"
                value={detail.assignmentSource ?? "—"}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resolution
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <DetailRow label="Costs" value={formatCurrency(detail.costs)} />
              <DetailRow label="Reason" value={detail.reason ?? "—"} />
              <DetailRow
                label="How We Fixed It"
                value={detail.howWeFixedIt ?? "—"}
              />
              <DetailRow
                label="Progress Description"
                value={detail.progressDescription ?? "—"}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attachments
            </h4>
            {detail.attachments.length === 0 ? (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                No attachments.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{attachment.fileName}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Links
            </h4>
            {detail.links.length === 0 ? (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                No links.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{link.description || link.linkType}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status History
            </h4>
            {detail.statusHistories.length === 0 ? (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                No status history.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.statusHistories.map((history) => (
                  <article key={history.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      {formatStatusLabel(history.oldStatus || "unknown")} → {formatStatusLabel(history.newStatus || "unknown")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(history.changedAt)}
                    </p>
                    {history.notes && (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap wrap-break-word">
                        {history.notes}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      By {history.changedByUser?.name ?? "System"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

interface MaintenanceRequestDetailsSheetProps {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaintenanceRequestDetailsSheet({
  requestId,
  open,
  onOpenChange,
}: MaintenanceRequestDetailsSheetProps) {
  const activeRequestId = open ? requestId : null;
  const { detail, isLoading, error, refetch } = useMaintenanceRequestDetail(activeRequestId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Request Details
          </SheetTitle>
          <SheetDescription>
            {detail
              ? `Request #${detail.id}`
              : requestId
                ? `Request #${requestId}`
                : "Request details"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading maintenance request details...
          </div>
        ) : error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="w-fit">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : detail ? (
          <MaintenanceRequestDetailsContent detail={detail} />
        ) : (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            No details available.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
