"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Boxes,
  Calendar,
  Pencil,
  Store,
  User,
} from "lucide-react";
import { EntryDetailItems } from "@/components/inventory/entry-detail-items";
import { useEntryDetail } from "@/lib/hooks/use-inventory-entries";
import { cn } from "@/lib/utils";

function MetricCell({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 py-3.5 sm:px-5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "truncate text-sm font-semibold tabular-nums",
          highlight && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EntryDetailSkeleton() {
  return (
    <div className="space-y-4 p-6 pt-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

interface EntryDetailSheetProps {
  entryId: number | null;
  /** Internal store id of the entry's store — sent so the backend can authorize
   *  a store_manager on the store-scoped entry-detail rule. */
  storeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntryDetailSheet({
  entryId,
  storeId,
  open,
  onOpenChange,
}: EntryDetailSheetProps) {
  const { entry, hasHistoryAccess, isLoading, error } = useEntryDetail(
    open ? entryId : null,
    storeId
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>
            {entry ? `Entry ${entry.reference}` : "Entry"}
          </SheetTitle>
          <SheetDescription>Submitted count detail.</SheetDescription>
        </SheetHeader>

        {/* Plain block scroll container (not Radix ScrollArea, whose display:table
            viewport grows to the widest child and stretches the whole sheet). A
            block div constrains children to the sheet width, so the wide items
            table scrolls inside its own overflow-x container instead. */}
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <EntryDetailSkeleton />
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : entry ? (
            <div className="space-y-4 p-6">
              {/* Info panel */}
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold leading-tight">
                          {entry.store?.name ?? "—"}
                        </p>
                        {entry.store?.store_number && (
                          <p className="text-xs text-muted-foreground">
                            {entry.store.store_number}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span>{entry.submitted_by}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="capitalize px-3 py-1 text-xs"
                    >
                      {entry.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="capitalize px-3 py-1 text-xs"
                    >
                      {entry.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x border-t">
                  <MetricCell icon={Calendar} label="Date" value={entry.date} />
                  <MetricCell
                    icon={Boxes}
                    label="Items"
                    value={entry.items_count}
                  />
                  <MetricCell
                    icon={Pencil}
                    label="Edited"
                    value={entry.edited_items_count}
                    highlight={entry.edited_items_count > 0}
                  />
                </div>
              </Card>

              <EntryDetailItems items={entry.items} canViewHistory={hasHistoryAccess} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
