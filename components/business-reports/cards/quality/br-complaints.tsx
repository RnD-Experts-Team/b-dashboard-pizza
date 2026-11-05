"use client";

import { useMemo, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric } from "@/components/dashboard-v1/v1-ui";
import type { PagedColumn } from "@/components/business-reports/paged-table";
import { compareText, fmtDate, fmtNumD } from "@/components/business-reports/report-format";
import type { WbrBulkResponse } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, plural } from "@/components/business-reports/cards/operations/br-shared";
import { DetailItem, RecordsDialog, groupByStore, useRecordWeeks, useWbrRecords, type WbrRecord } from "./br-records";

type Complaint = WbrRecord<"complaints">;

const fullName = (c: Complaint) => `${c.first_name} ${c.last_name}`.trim();
const dateOf = (c: Complaint) => c.complaint_date;
const informed = (c: Complaint) => c.manager_informed?.trim().toLowerCase() === "yes";

const COLUMNS: PagedColumn<Complaint>[] = [
  { key: "date", header: "Date", sortValue: dateOf, render: (c) => fmtDate(c.complaint_date), className: "whitespace-nowrap" },
  { key: "store", header: "Store", sortValue: (c) => c.storeDisplay, render: (c) => c.storeDisplay },
  { key: "name", header: "Customer", sortValue: fullName, render: fullName },
  {
    key: "issue",
    header: "Issue",
    render: (c) => <span className="line-clamp-2 min-w-[260px] whitespace-normal">{c.issue}</span>,
  },
  { key: "mgr", header: "Mgr Informed", sortValue: (c) => c.manager_informed, render: (c) => c.manager_informed },
];

const searchText = (c: Complaint) => `${fullName(c)} ${c.storeDisplay} ${c.issue} ${c.suggestion} ${c.phone} ${c.email}`;

function ComplaintDetail({ c }: { c: Complaint }) {
  return (
    <>
      <DetailItem label="Store" value={c.storeDisplay} />
      <DetailItem label="Date" value={fmtDate(c.complaint_date)} />
      <DetailItem label="Customer" value={fullName(c)} />
      <DetailItem label="Mgr Informed" value={c.manager_informed} />
      <DetailItem label="Phone" value={c.phone} />
      <DetailItem label="Email" value={c.email} />
      <DetailItem label="Issue" value={c.issue} wide />
      <DetailItem label="Suggestion" value={c.suggestion} wide />
      <DetailItem label="Submitted" value={fmtDate(c.submitted_at)} />
    </>
  );
}

function ComplaintsDialog({ records, onClose }: { records: Complaint[]; onClose: () => void }) {
  const weeks = useRecordWeeks(records, dateOf);
  const informedCount = useMemo(() => records.filter(informed).length, [records]);
  const latest = useMemo(
    () => records.reduce<string | null>((max, c) => (compareText(c.complaint_date, max) > 0 ? c.complaint_date : max), null),
    [records],
  );
  return (
    <RecordsDialog
      title="Complaints"
      category="quality"
      noun="complaint"
      rows={records}
      dateOf={dateOf}
      stats={[
        { label: "Mgr informed", value: informedCount.toLocaleString(), sub: `of ${plural(records.length, "complaint")}` },
        { label: "Per week", value: weeks.length ? fmtNumD(records.length / weeks.length) : "0", sub: plural(weeks.length, "week") },
        { label: "Latest", value: fmtDate(latest) },
      ]}
      columns={COLUMNS}
      rowKey={(c) => c.id}
      initialSort="date"
      searchText={searchText}
      detailTitle={(c) => (
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span>{fullName(c) || "Complaint"}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {c.storeDisplay} · {fmtDate(c.complaint_date)}
          </span>
        </span>
      )}
      renderDetail={(c) => <ComplaintDetail c={c} />}
      onClose={onClose}
    />
  );
}

/** Customer complaints across the stores, latest first. */
export function BrComplaintsCard({ data }: { data: WbrBulkResponse }) {
  const records = useWbrRecords(data, "complaints");
  const [open, setOpen] = useState(false);
  const latest = useMemo(
    () => [...records].sort((a, b) => compareText(b.complaint_date, a.complaint_date)),
    [records],
  );
  const stores = useMemo(() => groupByStore(records).length, [records]);
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
                  <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{c.storeDisplay}</span>
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
      {open && <ComplaintsDialog records={records} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
