"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEmployeeDebriefDetail } from "@/lib/hooks/use-employee-debriefs";
import type { DebriefAttachment } from "@/types/employee-debrief.types";
import { AlertCircle, CalendarDays, Paperclip, User, UserCog } from "lucide-react";

interface EmployeeDebriefDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  debriefId: number | string | null;
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(a: DebriefAttachment): boolean {
  const mime = (a.mimeType || "").toLowerCase();
  const name = (a.originalName || a.filePath || "").toLowerCase();
  return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
}

function AttachmentCard({ attachment }: { attachment: DebriefAttachment }) {
  const label = attachment.originalName || `Attachment #${attachment.id}`;
  const sizeLabel = formatFileSize(attachment.size);

  if (!attachment.attachmentUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground/60">
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  if (isImageAttachment(attachment)) {
    return (
      <a
        href={attachment.attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/40"
        title={`Open ${label}`}
      >
        <img
          src={attachment.attachmentUrl}
          alt={label}
          className="h-14 w-14 shrink-0 rounded-md border object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:underline">{label}</p>
          {sizeLabel && <p className="text-xs text-muted-foreground">{sizeLabel}</p>}
        </div>
      </a>
    );
  }

  return (
    <a
      href={attachment.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/40"
      title={`Open ${label}`}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
        <Paperclip className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:underline">{label}</p>
        {sizeLabel && <p className="text-xs text-muted-foreground">{sizeLabel}</p>}
      </div>
    </a>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {multiline ? (
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-sm">
          {value || "—"}
        </p>
      ) : (
        <p className="text-sm font-medium">{value || "—"}</p>
      )}
    </div>
  );
}

export function EmployeeDebriefDetailSheet({
  open,
  onOpenChange,
  storeId,
  debriefId,
}: EmployeeDebriefDetailSheetProps) {
  const { detail, isLoading, error } = useEmployeeDebriefDetail(
    open ? storeId : null,
    open ? debriefId : null
  );

  const writtenDate =
    detail?.date ?? detail?.createdAt;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 pb-4 pt-6">
          <SheetTitle className="text-lg">Debrief Details</SheetTitle>
          <SheetDescription>
            Full information for employee debrief #{debriefId}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {isLoading && (
          <div className="space-y-4 px-6 py-6">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!isLoading && error && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isLoading && !error && detail && (
          <div className="space-y-6 px-6 py-6">
            {/* Header meta: employee + date */}
            <div className="flex flex-wrap items-center gap-2">
              {detail.employeeName && (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
                  <User className="h-3.5 w-3.5" />
                  {detail.employeeName}
                </Badge>
              )}
              {writtenDate && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(writtenDate)}
                </Badge>
              )}
              {detail.authorName && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
                  <UserCog className="h-3.5 w-3.5" />
                  {detail.authorName}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Core info */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DetailRow label="Debrief ID" value={String(detail.id)} />
              {detail.employeeId != null && (
                <DetailRow label="Employee ID" value={String(detail.employeeId)} />
              )}
              {detail.storeId && (
                <DetailRow label="Store ID" value={detail.storeId} />
              )}
              <DetailRow
                label="Date Written"
                value={formatDate(writtenDate)}
              />
              {detail.authorName && (
                <DetailRow label="Written By" value={detail.authorName} />
              )}
              {detail.updatedAt && (
                <DetailRow
                  label="Last Updated"
                  value={formatDateTime(detail.updatedAt)}
                />
              )}
            </div>

            {/* Notes — always show this section; falls back to a placeholder */}
            <Separator />
            <div className="space-y-5">
              {detail.notes ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                  <div className="min-h-[100px] whitespace-pre-wrap break-words rounded-lg border bg-muted/40 px-4 py-4 text-sm leading-relaxed">
                    {detail.notes}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                  <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed px-4 py-4">
                    <p className="text-sm text-muted-foreground">No notes recorded.</p>
                  </div>
                </div>
              )}
              {detail.content && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Content
                  </p>
                  <div className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 px-4 py-4 text-sm leading-relaxed">
                    {detail.content}
                  </div>
                </div>
              )}
              {detail.summary && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Summary
                  </p>
                  <div className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 px-4 py-4 text-sm leading-relaxed">
                    {detail.summary}
                  </div>
                </div>
              )}
            </div>

            {/* Attachments */}
            {detail.attachments && detail.attachments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({detail.attachments.length})
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {detail.attachments.map((attachment) => (
                      <AttachmentCard key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
