"use client";

import { useState, type ComponentType } from "react";
import { Car, DoorOpen, Smile, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { fmtNum, fmtNumD, fmtPct } from "@/components/business-reports/report-format";
import type { CustomerServiceAverages, QualitySection } from "@/types/business-reports.types";
import {
  NO_VALUE,
  useStoreFocus,
  useStoreRows,
  type StoreRow,
} from "@/components/business-reports/cards/operations/br-shared";

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
  { key: "lobby", header: "Lobby (min)", numeric: true, sortValue: (r) => r.data.lobby_points, render: (r) => minutesOrDash(r.data.lobby_points) },
  { key: "drive", header: "Drive-Thru (min)", numeric: true, sortValue: (r) => r.data.drive_thru_points, render: (r) => minutesOrDash(r.data.drive_thru_points) },
];

function CustomerServiceDialog({ data, onClose }: { data: QualitySection; onClose: () => void }) {
  const rows = useStoreRows(data.customer_service.by_store);
  const focus = useStoreFocus<Row>();
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title="Customer Service" badgeText="By store · lobby & drive-thru: lower is better">
      <V1SubLabel className="mb-1">By store</V1SubLabel>
      <PagedTable
        rows={rows}
        columns={STORE_COLUMNS}
        rowKey={(r) => r.store}
        initialSort="guest"
        onRowClick={focus.onRowClick}
        footerNote={focus.footerNote}
      />
    </WbrDetailDialog>
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
