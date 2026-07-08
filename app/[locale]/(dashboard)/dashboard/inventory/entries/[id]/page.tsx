"use client";

import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Calendar,
  Loader2,
  Pencil,
  Store,
  User,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EntryDetailItems } from "@/components/inventory/entry-detail-items";
import { useEntryDetail } from "@/lib/hooks/use-inventory-entries";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";

/** A single metric cell in the bottom stats strip. */
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
    <div className="flex flex-col gap-1 px-5 py-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          highlight && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Entry detail — summary + items (with recount when the token allows it). */
export default function EntryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const id = Number(params?.id);

  // The entry URL has no store; send the user's current store_number (human id,
  // not internal) as X-Store-Id so the store-scoped entry-detail rule authorizes.
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeNumber = selectedStore?.storeId ?? overviewStores?.[0]?.storeId;

  const { entry, hasHistoryAccess, isLoading, error } = useEntryDetail(
    Number.isFinite(id) ? id : null,
    storeNumber
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry ? `Entry ${entry.reference}` : "Entry"}
        description="Submitted count detail."
      >
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/inventory/entries`)}
        >
          <ArrowLeft className="me-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading entry…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : entry ? (
        <>
          {/* ── Info panel ───────────────────────────────────────────── */}
          <Card className="overflow-hidden">
            {/* Primary row — store + submitted by + badges */}
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

              {/* Badges — type + status */}
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

            {/* Stats strip */}
            <div className="grid grid-cols-3 divide-x border-t">
              <MetricCell
                icon={Calendar}
                label="Date"
                value={entry.date}
              />
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
        </>
      ) : null}
    </div>
  );
}
