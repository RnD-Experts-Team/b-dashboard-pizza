"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Loader2, PencilLine, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/maintenance-tickets/form-bits";
import { getTicketsFieldErrors, isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { usePlaceLevels, useStorageWrites } from "@/lib/hooks/use-storage";
import { useStockCounts } from "@/lib/hooks/use-stock-count";
import { formatMoney } from "@/lib/maintenance/money";
import { PLACE_SEPARATOR } from "@/lib/storage/stock-forms";
import { formatWireDateTime } from "@/lib/utils/date-display";
import { useResetOnOpen } from "./discard-guard";
import { StorageEmptyState, StorageErrorState, StorageSkeleton, TBL, TD, TH } from "./storage-shared";
import type { StockCount, StockCountStatus } from "@/types/maintenance-v2";
import type { StorageLocation } from "@/types/storage.types";

/**
 * Stock counts: every count (drafts first by date), and "Start a count" —
 * pick the location and, optionally, one spot in it. The sheet lists every
 * part that has stock there, expected = what the system thinks.
 */

const ALL = "__all__";
const NONE = "__none__";
const COUNTS_PER_READ = 100;

export interface CountsTabProps {
  locationId?: number;
  status?: StockCountStatus;
  onFiltersChange: (patch: Record<string, string | number | null>) => void;
  locations: readonly StorageLocation[];
  liveLocations: readonly StorageLocation[];
  canStart: boolean;
  revision: number;
}

export function countPlaceLabel(count: Pick<StockCount, "storageLocation" | "storagePlaceValue">): string {
  const place = count.storagePlaceValue;
  const spot = place ? [place.level, place.value].filter(Boolean).join(" ") : "";
  return [count.storageLocation?.name, spot].filter(Boolean).join(PLACE_SEPARATOR);
}

export function CountStatusBadge({ status }: { status: StockCountStatus }) {
  const t = useTranslations("maintenanceV2");
  const applied = status === "applied";
  const Icon = applied ? CheckCircle2 : PencilLine;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        applied ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`storage.counts.status.${status}`)}
    </Badge>
  );
}

export function CountsTab({ locationId, status, onFiltersChange, locations, liveLocations, canStart, revision }: CountsTabProps) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const filters = useMemo(() => ({ storageLocationId: locationId, status, perPage: COUNTS_PER_READ }), [locationId, status]);
  const { counts, isLoading, isRefreshing, error, refresh } = useStockCounts(filters);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (revision) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const filtered = Boolean(locationId || status);
  const startButton = canStart ? (
    <Button onClick={() => setStarting(true)}>
      <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
      {t("stock.startCount")}
    </Button>
  ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={locationId ? String(locationId) : ALL} onValueChange={(v) => onFiltersChange({ loc: v === ALL ? null : Number(v) })}>
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label={t("storage.stock.locationFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("storage.stock.allLocations")}</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status ?? ALL} onValueChange={(v) => onFiltersChange({ status: v === ALL ? null : v })}>
          <SelectTrigger className="h-9 w-full sm:w-40" aria-label={t("common.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("storage.counts.allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("storage.counts.status.draft")}</SelectItem>
            <SelectItem value="applied">{t("storage.counts.status.applied")}</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onFiltersChange({ loc: null, status: null })}>
            {t("common.clearAll")}
          </Button>
        )}
        <div className="sm:ms-auto">{startButton}</div>
      </div>

      {error && counts.length === 0 && <StorageErrorState message={error.message} onRetry={() => void refresh()} />}
      {!error && isLoading && counts.length === 0 && <StorageSkeleton />}
      {!error && !isLoading && counts.length === 0 && (
        <StorageEmptyState
          icon={ClipboardList}
          description={filtered ? t("storage.counts.emptyFiltered") : t("storage.counts.empty")}
          action={filtered ? undefined : startButton}
        />
      )}
      {counts.length > 0 && (
        <div className={cn("overflow-x-auto rounded-md border bg-card", isRefreshing && "opacity-70")}>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>{t("storage.counts.count")}</th>
                <th className={TH}>{t("common.status")}</th>
                <th className={TH}>{t("storage.counts.started")}</th>
                <th className={cn(TH, "text-end")}>{t("stock.counted")}</th>
                <th className={cn(TH, "text-end")}>{t("storage.counts.missingValue")}</th>
                <th className={cn(TH, "text-end")}>{t("storage.counts.extraValue")}</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-muted/40">
                  <td className={TD}>
                    <Link href={`/${locale}/dashboard/storage/counts/${count.id}`} className="font-medium hover:underline">
                      {countPlaceLabel(count) || t("storage.counts.countNumber", { id: count.id })}
                    </Link>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{t("storage.counts.countNumber", { id: count.id })}</p>
                  </td>
                  <td className={TD}>
                    <CountStatusBadge status={count.status} />
                  </td>
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                    {count.startedAt ? formatWireDateTime(count.startedAt, { dateTimePattern: "MMM d, yyyy h:mm a" }) : "—"}
                    {count.creator && <p className="text-[11px] text-muted-foreground">{count.creator.name}</p>}
                  </td>
                  <td className={cn(TD, "text-end tabular-nums")}>
                    {count.totals ? `${count.totals.countedLines}/${count.totals.totalLines}` : "—"}
                  </td>
                  <td className={cn(TD, "text-end tabular-nums")}>{count.totals ? formatMoney(count.totals.missingValue) : "—"}</td>
                  <td className={cn(TD, "text-end tabular-nums")}>{count.totals ? formatMoney(count.totals.extraValue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StartCountDialog
        open={starting}
        onOpenChange={setStarting}
        locations={liveLocations}
        defaultLocationId={locationId}
      />
    </div>
  );
}

function StartCountDialog({
  open,
  onOpenChange,
  locations,
  defaultLocationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: readonly StorageLocation[];
  defaultLocationId?: number;
}) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const router = useRouter();
  const { startCount } = useStorageWrites();
  const [locationId, setLocationId] = useState<number | null>(defaultLocationId ?? null);
  const [placeValueId, setPlaceValueId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { levels } = usePlaceLevels(locationId);

  useResetOnOpen(open, () => {
    setLocationId(defaultLocationId ?? null);
    setPlaceValueId(null);
    setErrors({});
  });

  const spots = levels.flatMap((level) => (level.values ?? []).filter((v) => !v.deletedAt).map((v) => ({ id: v.id, label: `${level.name} ${v.value}` })));

  async function submit() {
    if (!locationId) {
      setErrors({ storage_location_id: t("storage.record.problems.required") });
      return;
    }
    try {
      const count = await startCount.run({ storageLocationId: locationId, storagePlaceValueId: placeValueId });
      toast.success(t("storage.counts.startedToast"));
      onOpenChange(false);
      router.push(`/${locale}/dashboard/storage/counts/${count.id}`);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getTicketsFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !startCount.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold">{t("stock.startCount")}</DialogTitle>
          <DialogDescription>{t("storage.counts.startHelp")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="count-location">
              {t("storage.movements.location")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={locationId ? String(locationId) : ""}
              onValueChange={(v) => {
                setLocationId(Number(v));
                setPlaceValueId(null);
                setErrors({});
              }}
            >
              <SelectTrigger id="count-location" className="h-9" aria-invalid={Boolean(errors.storage_location_id)}>
                <SelectValue placeholder={t("storage.record.pickLocation")} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.storage_location_id} />
          </div>
          {locationId != null && spots.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="count-spot">
                {t("storage.counts.onlySpot")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Select value={placeValueId ? String(placeValueId) : NONE} onValueChange={(v) => setPlaceValueId(v === NONE ? null : Number(v))}>
                <SelectTrigger id="count-spot" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("storage.counts.wholeLocation")}</SelectItem>
                  {spots.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t("storage.counts.onlySpotHelp")}</p>
              <FieldError message={errors.storage_place_value_id} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={startCount.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={startCount.isPending}>
            {startCount.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("stock.startCount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
