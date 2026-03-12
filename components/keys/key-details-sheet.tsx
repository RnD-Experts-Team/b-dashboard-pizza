"use client";

import { useMemo } from "react";
import { useKeyDetail } from "@/lib/hooks/use-keys";
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
import {
  Calendar,
  Database,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Tag,
  Store,
  Users,
} from "lucide-react";
import type { EngineKey, FillMode, StoreRule } from "@/types/key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const FILL_MODE_LABELS: Record<FillMode, string> = {
  store_once: "Store Once",
  role_each: "Role Each",
};

const WEEK_DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function formatWeekDays(days: number[] | null): string {
  if (!days || days.length === 0) return "—";
  return days.map((d) => WEEK_DAY_LABELS[d] || `Day ${d}`).join(", ");
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Detail content                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function KeyDetailsContent({ engineKey }: { engineKey: EngineKey }) {
  const sortedRules = useMemo(
    () =>
      [...engineKey.storeRules].sort((a, b) =>
        a.storeId.localeCompare(b.storeId)
      ),
    [engineKey.storeRules]
  );

  return (
    <>
      {/* Key metadata */}
      <div className="grid grid-cols-1 gap-3 px-4 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Tag className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">{engineKey.label}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4 shrink-0" />
          <span>
            Type: <span className="font-medium text-foreground">{engineKey.dataType}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Hash className="h-4 w-4 shrink-0" />
          <span>
            ID: <span className="font-medium text-foreground">{engineKey.id}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={engineKey.isActive ? "default" : "secondary"}>
            {engineKey.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {engineKey.createdAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Created: {formatDate(engineKey.createdAt)}</span>
          </div>
        )}

        {engineKey.updatedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Updated: {formatDate(engineKey.updatedAt)}</span>
          </div>
        )}
      </div>

      <Separator className="my-3" />

      {/* Store rules */}
      <ScrollArea className="h-[calc(100vh-18rem)] px-4 pb-6 sm:h-[calc(100vh-16rem)]">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Store Rules ({sortedRules.length})
        </h4>

        {sortedRules.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No store rules configured for this key.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedRules.map((rule) => (
              <StoreRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

function StoreRuleCard({ rule }: { rule: StoreRule }) {
  return (
    <article className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
          Store: {rule.storeId}
        </div>
        <Badge variant="outline">
          {FREQUENCY_LABELS[rule.frequencyType] || rule.frequencyType}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Interval: {rule.interval}</span>
        <span>Starts: {formatDate(rule.startsAt)}</span>
        {rule.endsAt && <span>Ends: {formatDate(rule.endsAt)}</span>}
        {rule.weekDays && rule.weekDays.length > 0 && (
          <span className="sm:col-span-2">
            Week Days: {formatWeekDays(rule.weekDays)}
          </span>
        )}
        {rule.monthDay != null && <span>Month Day: {rule.monthDay}</span>}
        {rule.weekDay != null && (
          <span>Week Day: {WEEK_DAY_LABELS[rule.weekDay] || rule.weekDay}</span>
        )}
        {rule.weekOfMonth != null && (
          <span>Week of Month: {rule.weekOfMonth === -1 ? "Last" : rule.weekOfMonth}</span>
        )}
        {rule.yearMonth != null && <span>Year Month: {rule.yearMonth}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>Fill Mode: <span className="font-medium text-foreground">{FILL_MODE_LABELS[rule.fillMode] ?? rule.fillMode}</span></span>
        </div>
        {rule.fillMode === "role_each" && rule.roleNames && rule.roleNames.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {rule.roleNames.map((r) => (
                <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sheet                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface KeyDetailsSheetProps {
  keyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyDetailsSheet({
  keyId,
  open,
  onOpenChange,
}: KeyDetailsSheetProps) {
  const activeKeyId = open ? keyId : null;
  const { key: engineKey, isLoading, error, refetch } = useKeyDetail(activeKeyId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>Key Details</SheetTitle>
          <SheetDescription>
            {engineKey
              ? `Key #${engineKey.id} — ${engineKey.label}`
              : keyId
                ? `Key #${keyId}`
                : "Key details"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading key details…
          </div>
        ) : error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="w-fit"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : engineKey ? (
          <KeyDetailsContent engineKey={engineKey} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No details available.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
