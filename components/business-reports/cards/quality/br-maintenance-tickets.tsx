"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useReport } from "@/components/business-reports/report-context";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import { compareText, fmtDate, fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import type { AnalyticsSummary } from "@/types/maintenance-analytics.types";
import {
  CARD_LIST_LIMIT,
  Count,
  DialogEmpty,
  DialogNote,
  NO_VALUE,
  ShareBars,
  storeSearch,
  useStoreFocus,
} from "@/components/business-reports/cards/operations/br-shared";

/** Literal hues per status, matching the maintenance status pills (status-accent.ts). */
const STATUS_HEX: Record<string, string> = {
  new: "#0ea5e9",
  in_review: "#6366f1",
  waiting_on_store: "#f59e0b",
  inspection: "#06b6d4",
  waiting_approval: "#d946ef",
  scheduled: "#8b5cf6",
  work_done: "#84cc16",
  closed: "#10b981",
  cancelled: "#a1a1aa",
};
const UNKNOWN_STATUS_HEX = "#94a3b8";
const ISSUE_COLOR = CATEGORIES.quality.chartColors[0];

type IssueRow = AnalyticsSummary["by_issue"][number];
type StatusRow = AnalyticsSummary["by_status"][number];

interface StoreTicketsRow {
  store: string;
  name: string;
  created: number;
  completed: number;
  open: number;
}

interface RecurringRow {
  key: string;
  store: string;
  storeLabel: string;
  ticketId: number;
  createdAt: string;
  title: string;
  status: string;
  count: number;
}

const issueKey = (r: IssueRow) => `${r.issue_id ?? "none"}-${r.title}`;
const issueSearch = (r: IssueRow) => r.title;

/** Issues by how often they were reported, most first. */
function useTopIssues(data: AnalyticsSummary): IssueRow[] {
  return useMemo(() => [...data.by_issue].sort((a, b) => b.count - a.count || compareText(a.title, b.title)), [data.by_issue]);
}

/* ── Dialog ──────────────────────────────────────────────────────────────── */

function IssuesTab({ issues, total }: { issues: IssueRow[]; total: number }) {
  const columns = useMemo<PagedColumn<IssueRow>[]>(
    () => [
      { key: "title", header: "Issue", sortValue: (r) => r.title, render: (r) => r.title },
      { key: "count", header: "Reported", numeric: true, sortValue: (r) => r.count, render: (r) => fmtNum(r.count) },
      { key: "share", header: "Share", numeric: true, sortValue: (r) => r.count, render: (r) => fmtPct(share(r.count, total)) },
    ],
    [total],
  );
  if (issues.length === 0) return <DialogEmpty>No issues reported in this range.</DialogEmpty>;
  return (
    <PagedTable
      size="lg"
      rows={issues}
      columns={columns}
      rowKey={issueKey}
      initialSort="count"
      searchText={issueSearch}
      searchPlaceholder="Search issues…"
    />
  );
}

const STORE_COLUMNS: PagedColumn<StoreTicketsRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "created", header: "Created", numeric: true, sortValue: (r) => r.created, render: (r) => fmtNum(r.created) },
  { key: "completed", header: "Completed", numeric: true, sortValue: (r) => r.completed, render: (r) => fmtNum(r.completed) },
  {
    key: "open",
    header: "Open",
    numeric: true,
    sortValue: (r) => r.open,
    render: (r) => <span className={r.open > 0 ? "text-amber-600 dark:text-amber-400" : undefined}>{fmtNum(r.open)}</span>,
  },
];

function StoresTab({ data }: { data: AnalyticsSummary }) {
  const { storeName } = useReport();
  const focus = useStoreFocus<StoreTicketsRow>();
  const rows = useMemo<StoreTicketsRow[]>(
    () => data.by_store.map((s) => ({ store: s.store_number, name: storeName(s.store_number), created: s.created, completed: s.completed, open: s.open })),
    [data.by_store, storeName],
  );
  if (rows.length === 0) return <DialogEmpty>No tickets at these stores in this range.</DialogEmpty>;
  return (
    <PagedTable
      size="lg"
      rows={rows}
      columns={STORE_COLUMNS}
      rowKey={(r) => r.store}
      initialSort="created"
      searchText={storeSearch}
      onRowClick={focus.onRowClick}
      footerNote={focus.footerNote}
    />
  );
}

function StatusesTab({ statuses }: { statuses: StatusRow[] }) {
  const rows = useMemo(
    () =>
      [...statuses]
        .sort((a, b) => b.count - a.count)
        .map((s) => ({ key: s.status, label: s.label, value: s.count, color: STATUS_HEX[s.status] ?? UNKNOWN_STATUS_HEX })),
    [statuses],
  );
  if (rows.length === 0) return <DialogEmpty>No open issues.</DialogEmpty>;
  return (
    <ReportBlock title="Open issues by status" description="Where every issue still open stands in the workflow.">
      <ShareBars size="lg" rows={rows} color={UNKNOWN_STATUS_HEX} />
    </ReportBlock>
  );
}

const RECURRING_COLUMNS: PagedColumn<RecurringRow>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.storeLabel, render: (r) => r.storeLabel },
  { key: "title", header: "Issue", sortValue: (r) => r.title, render: (r) => r.title },
  {
    key: "count",
    header: "Times reported",
    numeric: true,
    sortValue: (r) => r.count,
    render: (r) => <span className="font-semibold text-red-600 dark:text-red-400">{fmtNum(r.count)}</span>,
  },
  { key: "ticket", header: "Ticket", numeric: true, sortValue: (r) => r.ticketId, render: (r) => `#${r.ticketId}` },
  { key: "created", header: "Opened", sortValue: (r) => r.createdAt, render: (r) => fmtDate(r.createdAt), className: "whitespace-nowrap" },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => r.status },
];

const recurringSearch = (r: RecurringRow) => `${r.storeLabel} ${r.title} #${r.ticketId}`;
const recurringStore = (r: RecurringRow) => r.store;

function RecurringTab({ data }: { data: AnalyticsSummary }) {
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const rows = useMemo<RecurringRow[]>(
    () =>
      data.created.flatMap((t) =>
        t.issues.flatMap((i) =>
          i.recurring_count === null
            ? []
            : [
                {
                  key: `${t.ticket_id}-${i.id}`,
                  store: t.store_number ?? "",
                  storeLabel: t.store_number ? storeName(t.store_number) : NO_VALUE,
                  ticketId: t.ticket_id,
                  createdAt: t.created_at,
                  title: i.title,
                  status: i.status.label,
                  count: i.recurring_count,
                },
              ],
        ),
      ),
    [data.created, storeName],
  );
  const offered = useMemo(() => [...new Set(rows.map(recurringStore).filter(Boolean))].sort(compareText), [rows]);
  const filtered = useMemo(() => inStores(rows, stores, recurringStore), [rows, stores]);
  const { min, days } = data.recurring_window;

  if (rows.length === 0) return <DialogEmpty>No recurring issues on the tickets opened in this range.</DialogEmpty>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DialogNote>
          An issue recurs when the same store reported it on {fmtNum(min)} or more tickets within {fmtNum(days)} days.
        </DialogNote>
        {offered.length > 1 && <StoreChecklist value={stores} onChange={setStores} stores={offered} className="h-8 w-64 text-sm" />}
      </div>
      <PagedTable
        size="lg"
        rows={filtered}
        columns={RECURRING_COLUMNS}
        rowKey={(r) => r.key}
        initialSort="count"
        searchText={recurringSearch}
      />
    </div>
  );
}

function MaintenanceDialog({ data, issues, onClose }: { data: AnalyticsSummary; issues: IssueRow[]; onClose: () => void }) {
  const k = data.kpis;
  const issueTotal = useMemo(() => issues.reduce((s, r) => s + r.count, 0), [issues]);
  const tabs: ReportTab[] = [
    { key: "issues", label: "Issues", content: <IssuesTab issues={issues} total={issueTotal} /> },
    { key: "stores", label: "By store", content: <StoresTab data={data} /> },
    { key: "statuses", label: "Statuses", content: <StatusesTab statuses={data.by_status} /> },
    { key: "recurring", label: "Recurring", content: <RecurringTab data={data} /> },
  ];
  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Maintenance Tickets"
      category="quality"
      stats={[
        { label: "Tickets created", value: fmtNum(k.tickets_created) },
        { label: "Issues created", value: fmtNum(k.issues_created) },
        { label: "Completed", value: fmtNum(k.issues_completed), sub: "issues", tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "Open", value: fmtNum(k.open_tickets), sub: "tickets", tone: k.open_tickets > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
        { label: "Recurring", value: fmtNum(k.recurring_issues), sub: "issues", tone: k.recurring_issues > 0 ? "text-red-600 dark:text-red-400" : undefined },
        { label: "Fixed, no ticket", value: fmtNum(k.fixed_by_troubleshooting), sub: "by troubleshooting" },
      ]}
      tabs={tabs}
    />
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */

/** Maintenance over the range at the loaded stores: the counts and the issues reported most. */
export function BrMaintenanceTicketsCard({ data }: { data: AnalyticsSummary }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const issues = useTopIssues(data);
  const issueTotal = useMemo(() => issues.reduce((s, r) => s + r.count, 0), [issues]);
  const k = data.kpis;
  const empty = k.tickets_created === 0 && issues.length === 0;

  return (
    <V1Card
      reportId="br-maintenance-tickets"
      title="Maintenance Tickets"
      category="quality"
      period="R"
      span={2}
      onExpand={empty ? undefined : () => setOpen(true)}
      headerControl={
        <Button variant="ghost" size="icon" className="ms-1 h-5 w-5 shrink-0" asChild>
          <Link
            href={`/${locale}/dashboard/maintenance-tickets`}
            aria-label="Open maintenance tickets"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {empty ? (
        <V1Empty icon={ClipboardList}>No tickets opened in this range.</V1Empty>
      ) : (
        <div className="flex h-full flex-col gap-2">
          <div className="grid grid-cols-5 gap-1">
            <V1Metric label="Tickets" value={<Count value={k.tickets_created} />} size="sm" />
            <V1Metric label="Issues" value={<Count value={k.issues_created} />} size="sm" />
            <V1Metric label="Completed" value={<Count value={k.issues_completed} />} accent="text-emerald-600 dark:text-emerald-400" size="sm" />
            <V1Metric
              label="Open"
              value={<Count value={k.open_tickets} />}
              accent={k.open_tickets > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              size="sm"
            />
            <V1Metric
              label="Recurring"
              value={<Count value={k.recurring_issues} />}
              accent={k.recurring_issues > 0 ? "text-red-600 dark:text-red-400" : undefined}
              size="sm"
            />
          </div>
          <div className="min-h-0 flex-1">
            <V1SubLabel className="mb-0.5">Most recurring issues</V1SubLabel>
            {issues.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No issues reported.</p>
            ) : (
              <ShareBars
                color={ISSUE_COLOR}
                total={issueTotal}
                limit={CARD_LIST_LIMIT}
                rows={issues.map((r) => ({ key: issueKey(r), label: r.title, value: r.count, title: r.title }))}
              />
            )}
            {issues.length > CARD_LIST_LIMIT && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                +{(issues.length - CARD_LIST_LIMIT).toLocaleString()} more — open for all
              </p>
            )}
          </div>
        </div>
      )}
      {open && <MaintenanceDialog data={data} issues={issues} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
