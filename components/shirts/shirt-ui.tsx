"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  SHIRT_STATUS_BADGE,
  SHIRT_STATUS_LABELS,
  daysUntilDue,
  formatPlainDate,
  resolveShirtAssetUrl,
} from "@/lib/shirts/shirt-utils";
import type { ShirtLogo, ShirtMilestoneStatus } from "@/types/shirt-milestone.types";

export function ShirtStatusBadge({ status }: { status: ShirtMilestoneStatus }) {
  return (
    <Badge variant={SHIRT_STATUS_BADGE[status]}>{SHIRT_STATUS_LABELS[status]}</Badge>
  );
}

export function ColorSwatch({
  hex,
  name,
  className,
}: {
  hex: string | null | undefined;
  name?: string | null;
  className?: string;
}) {
  if (!hex) {
    return (
      <span
        className={cn(
          "inline-block h-4 w-4 shrink-0 rounded-full border border-dashed",
          className,
        )}
        title="No colour"
      />
    );
  }
  return (
    <span
      className={cn("inline-block h-4 w-4 shrink-0 rounded-full border", className)}
      style={{ backgroundColor: hex }}
      title={name ?? hex}
    />
  );
}

export function LogoThumb({
  logo,
  className,
}: {
  logo: ShirtLogo | null | undefined;
  className?: string;
}) {
  const src = resolveShirtAssetUrl(logo?.file_url);
  if (!src) {
    return (
      <span
        className={cn(
          "inline-block h-6 w-6 shrink-0 rounded border border-dashed",
          className,
        )}
        title="No logo"
      />
    );
  }
  // Plain <img>: /hiring-storage/... is same-origin, so next/image's
  // remotePatterns would be extra config for no benefit.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      title={logo?.name ?? undefined}
      className={cn("h-6 w-6 shrink-0 object-contain", className)}
    />
  );
}

/**
 * Due date plus how overdue it is. The date goes through formatPlainDate
 * rather than toLocaleDateString, so it never renders a day early.
 */
export function DueCell({ due }: { due: string | null }) {
  const days = daysUntilDue(due);
  return (
    <div className="flex flex-col">
      <span>{formatPlainDate(due)}</span>
      {days !== null && days < 0 && (
        <span className="text-xs text-destructive">
          {Math.abs(days)} {Math.abs(days) === 1 ? "day" : "days"} overdue
        </span>
      )}
      {days !== null && days >= 0 && days <= 3 && (
        <span className="text-xs text-muted-foreground">
          {days === 0 ? "Due today" : `In ${days} ${days === 1 ? "day" : "days"}`}
        </span>
      )}
    </div>
  );
}

export function ShirtQueueSkeleton({ columns }: { columns: string[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              {columns.map((c, j) => (
                <TableCell key={`${c}-${j}`}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ShirtEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

/** Label/value row for the detail sheet and the history summary. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{children}</span>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">
      {children}
    </h3>
  );
}
