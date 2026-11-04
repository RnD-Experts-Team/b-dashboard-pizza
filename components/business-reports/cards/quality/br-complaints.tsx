"use client";

import { useMemo, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { DetailField } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { fmtDate } from "@/components/business-reports/report-format";
import type { WbrBulkComplaint, WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, plural } from "@/components/business-reports/cards/operations/br-shared";
import { RecordsDialog, useWbrRecords } from "./br-records";

const fullName = (c: WbrBulkComplaint) => `${c.first_name} ${c.last_name}`.trim();

const COLUMNS: PagedColumn<WbrBulkComplaint>[] = [
  { key: "date", header: "Date", sortValue: (c) => c.complaint_date, render: (c) => fmtDate(c.complaint_date), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (c) => c.store_label, render: (c) => c.store_label },
  { key: "name", header: "Customer", sortValue: fullName, render: fullName },
  {
    key: "issue",
    header: "Issue",
    render: (c) => <span className="line-clamp-2 min-w-[220px] whitespace-normal">{c.issue}</span>,
  },
  { key: "mgr", header: "Mgr Informed", sortValue: (c) => c.manager_informed, render: (c) => c.manager_informed },
];

function ComplaintDetail({ c }: { c: WbrBulkComplaint }) {
  return (
    <>
      <DetailField label="Store" value={c.store_label} />
      <DetailField label="Date" value={fmtDate(c.complaint_date)} />
      <DetailField label="Phone" value={c.phone} />
      <DetailField label="Email" value={c.email} />
      <DetailField label="Mgr Informed" value={c.manager_informed} />
      <DetailField label="Issue" value={c.issue} wrap />
      <DetailField label="Suggestion" value={c.suggestion} wrap />
    </>
  );
}

/** Customer complaints across the stores, latest first. */
export function BrComplaintsCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "complaints");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => b.complaint_date.localeCompare(a.complaint_date)),
    [records],
  );
  const stores = useMemo(() => new Set(records.map((c) => c.store_label)).size, [records]);
  const empty = records.length === 0;

  return (
    <V1Card
      reportId="br-complaints"
      title="Complaints"
      category="quality"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      {empty ? (
        <V1Empty icon={MessageSquareWarning}>No complaints in this range</V1Empty>
      ) : (
        <div className="space-y-1.5">
          <V1Metric label="Complaints" value={records.length.toLocaleString()} sub={`at ${plural(stores, "store")}`} size="sm" />
          {latest.slice(0, CARD_LIST_LIMIT).map((c) => (
            <div key={c.id} className="rounded-md bg-background/40 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-semibold">
                  {fullName(c)}
                  <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{c.store_label}</span>
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(c.complaint_date)}</span>
              </div>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{c.issue}</p>
            </div>
          ))}
          {records.length > CARD_LIST_LIMIT && (
            <p className="text-[10px] text-muted-foreground">
              +{(records.length - CARD_LIST_LIMIT).toLocaleString()} more — open for all
            </p>
          )}
        </div>
      )}
      {open && (
        <RecordsDialog
          title="Complaints"
          noun="record"
          rows={records}
          columns={COLUMNS}
          rowKey={(c) => c.id}
          initialSort="date"
          detailTitle={(c) => (
            <span className="flex items-center justify-between gap-2">
              <span>{fullName(c)}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{fmtDate(c.complaint_date)}</span>
            </span>
          )}
          renderDetail={(c) => <ComplaintDetail c={c} />}
          onClose={() => setOpen(false)}
        />
      )}
    </V1Card>
  );
}
