"use client";

import { useMemo, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useBootsOnTheGround } from "@/lib/hooks/use-screen-usage";
import { daysToInstants } from "@/lib/maintenance-tickets/local-range";
import { openSeconds, storeOpenHours } from "@/lib/screen-usage/open-hours";
import { formatDuration, percent } from "@/lib/screen-usage/format";
import { businessWeekStart } from "@/lib/utils/business-week";
import type { BootsManager, BootsOnTheGround, BootsTimes } from "@/lib/screen-usage/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { V1Card, type V1Span } from "../v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1Progress, V1SubLabel, V1Toggle } from "../v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  Boots on the Ground — Screen Project usage on the store dashboards
 *  (DSPR V1 and Business Reports). A manager sees themselves and their
 *  partners at the same stores: talking time (Active Engagement), time with a
 *  face on camera (Store Presence) and that presence per station. A person's
 *  shares are of their stores' OPEN hours, never of their connected time.
 *  Data: ScreensPizza GET /usage/boots-on-the-ground (rule: reports view).
 * ────────────────────────────────────────────────────────────────────────── */

const ALL = "all";
const ZERO: BootsTimes = { connected: 0, present: 0, talking: 0 };
const SKELETON_ROWS = 4;

type DayOrWeek = "D" | "W";

type RangeProps =
  /** DSPR V1: the selected day, with a Day / Week-to-date toggle (Tue–Mon business week). */
  | { day: string; startDate?: never; endDate?: never }
  /** Business Reports: a fixed inclusive range. */
  | { day?: never; startDate: string; endDate: string };

type Props = RangeProps & {
  /** Store numbers, e.g. "03795-00001". */
  stores: string[];
  span?: V1Span;
  className?: string;
};

interface StationRow {
  key: string;
  name: string;
  times: BootsTimes;
}

const stationKey = (name: string) => name.trim().toLowerCase();

function add(a: BootsTimes, b: BootsTimes): BootsTimes {
  return { connected: a.connected + b.connected, present: a.present + b.present, talking: a.talking + b.talking };
}

/** Every station of the stores, merged by name (a "Register" in each store is one row), with these people's time. */
function stationRows(data: BootsOnTheGround, people: BootsManager[]): StationRow[] {
  const keyOf = new Map(data.stations.map((s) => [s.station_id, stationKey(s.name)]));
  const timeByKey = people
    .flatMap((m) => m.stations)
    .reduce((acc, s) => {
      const key = keyOf.get(s.station_id);
      return key === undefined ? acc : acc.set(key, add(acc.get(key) ?? ZERO, s));
    }, new Map<string, BootsTimes>());
  // In the server's order (store, name); the first spelling of a name is the one shown.
  const names = data.stations.reduce(
    (acc, s) => (acc.has(stationKey(s.name)) ? acc : acc.set(stationKey(s.name), s.name.trim())),
    new Map<string, string>(),
  );
  return [...names].map(([key, name]) => ({ key, name, times: timeByKey.get(key) ?? ZERO }));
}

/** Open seconds of these stores between the instants; null when none of them has opening hours set. */
function openHoursOf(
  codes: string[],
  overviewStores: { storeId?: string; metadata: Record<string, unknown> }[],
  fromMs: number,
  toMs: number,
): number | null {
  const hours = new Map(overviewStores.map((s) => [s.storeId, storeOpenHours(s.metadata)]));
  const known = codes.flatMap((code) => {
    const h = hours.get(code);
    return h ? [h] : [];
  });
  return known.length ? known.reduce((sum, h) => sum + openSeconds(h, fromMs, toMs), 0) : null;
}

function shareLine(part: number, picked: BootsManager | null, open: number | null, managers: number): string {
  if (picked === null) return `${managers} managers together`;
  if (open === null) return "Open hours not set";
  return `${percent(part, open)} of open hours`;
}

/** Two short lines, so the share is never cut off on a narrow card. */
function TileSub({ label, share }: { label: string; share: string }) {
  return (
    <>
      <span className="block truncate">{label}</span>
      <span className="block truncate font-semibold text-foreground/80">{share}</span>
    </>
  );
}

export function V1BootsOnTheGroundCard({ stores, day, startDate, endDate, span = 1, className }: Props) {
  const [mode, setMode] = useState<DayOrWeek>("D");
  // The union guarantees one of the two; "" (no range) loads nothing.
  const from = (day ? { D: day, W: businessWeekStart(day) }[mode] : startDate) ?? "";
  const to = day ?? endDate ?? "";
  const params = useMemo(() => {
    const range = daysToInstants(from, to);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return stores.length && range ? { stores, from: range.from, to: range.to, tz } : null;
  }, [stores, from, to]);
  const { data, isLoading, error, refetch } = useBootsOnTheGround(params);

  const headerControl = day ? (
    <V1Toggle<DayOrWeek>
      className="ms-1"
      value={mode}
      onChange={setMode}
      options={[
        { value: "D", label: "Day" },
        { value: "W", label: "WTD" },
      ]}
    />
  ) : undefined;

  return (
    <V1Card
      title="Boots on the Ground"
      category="sales"
      period={day ? mode : "R"}
      showPeriodBadge={!day}
      headerControl={headerControl}
      span={span}
      className={className}
      reportId="boots-on-the-ground"
    >
      <BootsBody data={data} isLoading={isLoading} error={error} onRetry={refetch} range={params} />
    </V1Card>
  );
}

function BootsBody({
  data,
  isLoading,
  error,
  onRetry,
  range,
}: {
  data: BootsOnTheGround | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  range: { from: string; to: string } | null;
}) {
  if (isLoading && !data) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-full" />
        <div className="grid grid-cols-2 gap-1">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (error && !data) {
    if (error.includes("403")) {
      return <V1Empty icon={MonitorSmartphone}>You can&apos;t see Screen Project usage for these stores.</V1Empty>;
    }
    return (
      <V1Empty icon={MonitorSmartphone}>
        Couldn&apos;t load Screen Project usage.{" "}
        <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={onRetry}>
          Try again
        </Button>
      </V1Empty>
    );
  }
  if (!data || !range || (data.managers.length === 0 && data.stations.length === 0)) {
    return <V1Empty icon={MonitorSmartphone}>No Screen Project activity in this period.</V1Empty>;
  }
  return <BootsLoaded data={data} range={range} />;
}

function BootsLoaded({ data, range }: { data: BootsOnTheGround; range: { from: string; to: string } }) {
  const [pickState, setPick] = useState<string | null>(null);
  const me = useAuthStore((s) => s.user?.id);
  const overviewStores = useAuthStore((s) => s.overviewStores);

  const myId = me != null ? String(me) : null;
  const options = useMemo(() => {
    const mine = data.managers.filter((m) => String(m.user_id) === myId);
    const others = data.managers.filter((m) => String(m.user_id) !== myId);
    return [
      ...mine.map((m) => ({ value: String(m.user_id), label: `You (${m.name})` })),
      ...others.map((m) => ({ value: String(m.user_id), label: m.name })),
      { value: ALL, label: `All managers (${data.managers.length})` },
    ];
  }, [data, myId]);
  // You first when you were on Screen Project; otherwise everyone together.
  const pick = options.find((o) => o.value === pickState)?.value ?? options[0].value;
  const picked = data.managers.find((m) => String(m.user_id) === pick) ?? null;
  const times = picked ?? data.totals;

  // A person's open hours: the stores they were seen in. Hours still to come are not owed yet.
  const open = useMemo(() => {
    if (!picked) return null;
    // eslint-disable-next-line react-hooks/purity -- "so far" moves on with each render of a running day
    const toMs = Math.min(Date.parse(range.to), Date.now());
    return openHoursOf(picked.stores, overviewStores ?? [], Date.parse(range.from), toMs);
  }, [picked, overviewStores, range]);

  const rows = useMemo(() => stationRows(data, picked ? [picked] : data.managers), [data, picked]);
  const maxPresent = Math.max(0, ...rows.map((r) => r.times.present));
  const managers = data.managers.length;

  return (
    <div className="space-y-1.5">
      {managers > 0 && (
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger size="sm" className="h-6 w-full text-[11px]" aria-label="Whose usage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <V1MetricGrid cols={2}>
        <V1Metric
          label="Active Engagement"
          value={formatDuration(times.talking)}
          sub={<TileSub label="Speaking with team" share={shareLine(times.talking, picked, open, managers)} />}
        />
        <V1Metric
          label="Store Presence"
          value={formatDuration(times.present)}
          sub={<TileSub label="Visible to store team" share={shareLine(times.present, picked, open, managers)} />}
        />
      </V1MetricGrid>

      <div className="space-y-1">
        <V1SubLabel>Station Presence Breakdown</V1SubLabel>
        {rows.length === 0 && <p className="text-[11px] text-muted-foreground">No stations set up.</p>}
        {rows.map((r) => (
          <div
            key={r.key}
            className="space-y-0.5"
            title={`Connected ${formatDuration(r.times.connected)} · Present ${formatDuration(r.times.present)} · Talking ${formatDuration(r.times.talking)}`}
          >
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-semibold tabular-nums">{formatDuration(r.times.present)}</span>
              <span className="truncate text-muted-foreground">{r.name}</span>
            </div>
            <V1Progress value={r.times.present} max={maxPresent} category="sales" />
          </div>
        ))}
      </div>

      <p className="text-[9.5px] text-muted-foreground/80">Bars show relative time, not performance scores.</p>
    </div>
  );
}
