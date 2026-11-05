"use client";

import { useMemo, useState, type ComponentType } from "react";
import { Car, DoorOpen, Smile, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import {
  RD_NUM,
  RD_TBL,
  RD_TD,
  RD_TH,
  ReportBlock,
  ReportDialog,
  type ReportTab,
} from "@/components/business-reports/report-dialog";
import { fmtNum, fmtNumD, fmtPct } from "@/components/business-reports/report-format";
import type { CustomerServiceAverages, QualitySection } from "@/types/business-reports.types";
import {
  DialogEmpty,
  NO_VALUE,
  ScoreBars,
  storeSearch,
  useStoreFocus,
  useStoreRows,
  type StoreRow,
} from "@/components/business-reports/cards/operations/br-shared";

const BAR_COLOR = CATEGORIES.quality.chartColors[0];
/** Rows each Overview list shows. */
const OVERVIEW_ROWS = 10;

type Row = StoreRow<CustomerServiceAverages>;

const pctOrDash = (v: number | null) => (v === null ? NO_VALUE : fmtPct(v));
const minutesOrDash = (v: number | null) => (v === null ? NO_VALUE : `${fmtNumD(v)} min`);

function StatBlock({
  icon: Icon,
  label,
  value,
  good,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Higher is better (green) vs lower is better (red accent, V1's look). */
  good: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg bg-background/55 px-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          good ? "bg-emerald-500/15 dark:bg-emerald-500/20" : "bg-red-500/15 dark:bg-red-500/20",
        )}
      >
        <Icon className={cn("h-4 w-4", good ? "text-emerald-500" : "text-red-500")} />
      </div>
      <p className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "shrink-0 text-xl font-bold leading-none tabular-nums",
          good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

const STORE_COLUMNS: PagedColumn<Row>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "entries", header: "Entries", numeric: true, sortValue: (r) => r.data.entries, render: (r) => fmtNum(r.data.entries) },
  { key: "guest", header: "Guest Service", numeric: true, sortValue: (r) => r.data.guest_service, render: (r) => pctOrDash(r.data.guest_service) },
  { key: "lobby", header: "Lobby", numeric: true, sortValue: (r) => r.data.lobby_points, render: (r) => minutesOrDash(r.data.lobby_points) },
  { key: "drive", header: "Drive-Thru", numeric: true, sortValue: (r) => r.data.drive_thru_points, render: (r) => minutesOrDash(r.data.drive_thru_points) },
];

/** The stores with the most minutes for one measure, slowest first. */
function slowest(rows: Row[], read: (a: CustomerServiceAverages) => number | null): Array<{ row: Row; minutes: number }> {
  return rows
    .flatMap((row) => {
      const minutes = read(row.data);
      return minutes === null ? [] : [{ row, minutes }];
    })
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, OVERVIEW_ROWS);
}

function SlowestTable({ rows }: { rows: Array<{ row: Row; minutes: number }> }) {
  if (rows.length === 0) return <DialogEmpty>No times recorded.</DialogEmpty>;
  return (
    <table className={RD_TBL}>
      <thead>
        <tr>
          <th className={RD_TH}>Store</th>
          <th className={cn(RD_TH, "text-end")}>Minutes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ row, minutes }) => (
          <tr key={row.store}>
            <td className={cn(RD_TD, "max-w-[260px] truncate")} title={row.name}>
              {row.name}
            </td>
            <td className={cn(RD_TD, RD_NUM, "font-semibold text-red-600 dark:text-red-400")}>{fmtNumD(minutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CustomerServiceDialog({ data, onClose }: { data: QualitySection; onClose: () => void }) {
  const cs = data.customer_service;
  const rows = useStoreRows(cs.by_store);
  const focus = useStoreFocus<Row>();
  const guest = useMemo(
    () =>
      rows
        .flatMap((r) => (r.data.guest_service === null ? [] : [{ r, score: r.data.guest_service }]))
        .sort((a, b) => a.score - b.score)
        .slice(0, OVERVIEW_ROWS)
        .map(({ r, score }) => ({ key: r.store, label: r.name, score, sub: `${fmtNum(r.data.entries)} entries`, title: r.name })),
    [rows],
  );
  const lobby = useMemo(() => slowest(rows, (a) => a.lobby_points), [rows]);
  const drive = useMemo(() => slowest(rows, (a) => a.drive_thru_points), [rows]);
  const reporting = rows.filter((r) => r.data.entries > 0).length;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Guest service" description="Lowest first." className="lg:col-span-2">
            {guest.length ? <ScoreBars rows={guest} color={BAR_COLOR} /> : <DialogEmpty>No guest service scores.</DialogEmpty>}
          </ReportBlock>
          <ReportBlock title="Slowest lobby" description="Average minutes, lower is better.">
            <SlowestTable rows={lobby} />
          </ReportBlock>
          <ReportBlock title="Slowest drive-thru" description="Average minutes, lower is better.">
            <SlowestTable rows={drive} />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={rows}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="guest"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote ? `lobby & drive-thru: lower is better · ${focus.footerNote}` : "lobby & drive-thru: lower is better"}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Customer Service"
      category="quality"
      stats={[
        { label: "Guest service", value: pctOrDash(cs.guest_service), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Lobby", value: minutesOrDash(cs.lobby_points), sub: "lower is better" },
        { label: "Drive-thru", value: minutesOrDash(cs.drive_thru_points), sub: "lower is better" },
        { label: "Entries", value: fmtNum(cs.entries) },
        { label: "Stores", value: fmtNum(reporting), sub: "with entries" },
      ]}
      tabs={tabs}
    />
  );
}

/** Guest service %, lobby and drive-thru minutes (lower is better), averaged over the range. */
export function BrCustomerServiceCard({ data }: { data: QualitySection }) {
  const [open, setOpen] = useState(false);
  const cs = data.customer_service;
  const empty = cs.entries === 0;

  return (
    <V1Card
      reportId="br-customer-service"
      title="Customer Service"
      category="quality"
      period="R"
      span={2}
      headerNote={empty ? undefined : `${fmtNum(cs.entries)} ${cs.entries === 1 ? "entry" : "entries"}`}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      {empty ? (
        <V1Empty icon={Users}>No customer service data in this range.</V1Empty>
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          <StatBlock icon={Smile} label="Guest Service" value={pctOrDash(cs.guest_service)} good />
          <StatBlock icon={DoorOpen} label="Lobby (min)" value={cs.lobby_points === null ? NO_VALUE : fmtNumD(cs.lobby_points)} good={false} />
          <StatBlock
            icon={Car}
            label="Drive-Thru (min)"
            value={cs.drive_thru_points === null ? NO_VALUE : fmtNumD(cs.drive_thru_points)}
            good={false}
          />
        </div>
      )}
      {open && <CustomerServiceDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
