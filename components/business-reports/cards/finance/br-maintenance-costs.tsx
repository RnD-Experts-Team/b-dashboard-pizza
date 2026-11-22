"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmt$Compact, fmtDay, fmtNum } from "@/components/business-reports/report-format";
import type { MaintenanceFinances, PaymentLineType } from "@/types/maintenance-system";
import { DialogEmpty, Money, ShareBars, TrendChart, plural, storeSearch, useStoreFocus } from "@/components/business-reports/cards/operations/br-shared";

/* ──────────────────────────────────────────────────────────────────────────
 *  Maintenance costs and payments for the loaded stores over the range
 *  (Maintenance GET /maintenance-analytics/finances). Mistaken payments are
 *  left out by the server; refunds net the spend. Unpaid work is what is
 *  owed NOW, not limited to the range.
 * ────────────────────────────────────────────────────────────────────────── */

/** One hue per payment line type, in the order the server lists them. */
const TYPE_HEX: Record<PaymentLineType, string> = {
  hourly: "#f43f5e",
  fixed: "#fb7185",
  inspection: "#f59e0b",
  parts: "#8b5cf6",
  gas: "#0ea5e9",
  other: "#94a3b8",
};
const STORE_COLOR = "#f43f5e";
const CARD_ROWS = 5;
const DIALOG_ROWS = 12;
const MINUTES_PER_HOUR = 60;

const num = (m: string | null | undefined): number => Number(m ?? 0) || 0;

interface StoreCost {
  key: string;
  store: string;
  name: string;
  amount: number;
}
interface NamedCost {
  key: string;
  name: string;
  sub: string;
  amount: number;
}
interface IssueCost {
  key: string;
  title: string;
  tickets: number;
  amount: number;
}
interface TicketCost {
  key: string;
  ticketId: number;
  store: string;
  title: string;
  amount: number;
}
interface RecurringCost {
  key: string;
  store: string;
  title: string;
  tickets: number;
  amount: number;
}

const STORE_COLUMNS: PagedColumn<StoreCost>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "amount", header: "Spent", numeric: true, sortValue: (r) => r.amount, render: (r) => fmt$2(r.amount) },
];
const namedColumns = (who: string): PagedColumn<NamedCost>[] => [
  { key: "name", header: who, sortValue: (r) => r.name, render: (r) => r.name },
  { key: "sub", header: "Category", sortValue: (r) => r.sub, render: (r) => r.sub || "—" },
  { key: "amount", header: "Paid", numeric: true, sortValue: (r) => r.amount, render: (r) => fmt$2(r.amount) },
];
const ISSUE_COLUMNS: PagedColumn<IssueCost>[] = [
  { key: "title", header: "Issue", sortValue: (r) => r.title, render: (r) => r.title },
  { key: "tickets", header: "Tickets", numeric: true, sortValue: (r) => r.tickets, render: (r) => fmtNum(r.tickets) },
  { key: "amount", header: "Cost", numeric: true, sortValue: (r) => r.amount, render: (r) => fmt$2(r.amount) },
  {
    key: "avg",
    header: "Per ticket",
    numeric: true,
    sortValue: (r) => (r.tickets > 0 ? r.amount / r.tickets : 0),
    render: (r) => (r.tickets > 0 ? fmt$2(r.amount / r.tickets) : "—"),
  },
];
const TICKET_COLUMNS: PagedColumn<TicketCost>[] = [
  { key: "ticket", header: "Ticket", sortValue: (r) => r.ticketId, render: (r) => `#${r.ticketId}` },
  { key: "store", header: "Store", sortValue: (r) => r.store, render: (r) => r.store },
  { key: "title", header: "Title", sortValue: (r) => r.title, render: (r) => r.title },
  { key: "amount", header: "Cost", numeric: true, sortValue: (r) => r.amount, render: (r) => fmt$2(r.amount) },
];
const RECURRING_COLUMNS: PagedColumn<RecurringCost>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.store, render: (r) => r.store },
  { key: "title", header: "Issue", sortValue: (r) => r.title, render: (r) => r.title },
  { key: "tickets", header: "Tickets", numeric: true, sortValue: (r) => r.tickets, render: (r) => fmtNum(r.tickets) },
  { key: "amount", header: "Cost", numeric: true, sortValue: (r) => r.amount, render: (r) => fmt$2(r.amount) },
];
const nameSearch = (r: { name: string }) => r.name;
const titleSearch = (r: { title: string; store?: string }) => `${r.title} ${r.store ?? ""}`;

function categoryName(c: MaintenanceFinances["byTechnician"][number]["category"]): string {
  if (!c) return "";
  return typeof c === "string" ? c : c.name;
}

/** The finances block as rows the card and dialog share. */
function useCosts(data: MaintenanceFinances) {
  const { storeName } = useReport();
  return useMemo(() => {
    const label = (store: string | null, other?: string | null) => {
      if (store) return storeName(store);
      return other === "storage" ? "Storage (bought for the shelf)" : "Other stores";
    };
    const types = data.byType
      .map((t) => ({ key: t.type, label: t.label, value: num(t.amount), color: TYPE_HEX[t.type] }))
      .filter((t) => t.value !== 0)
      .sort((a, b) => b.value - a.value);
    const stores: StoreCost[] = data.byStore
      .map((s, i) => ({ key: `${s.storeNumber ?? s.other ?? "other"}-${i}`, store: s.storeNumber ?? "", name: label(s.storeNumber, s.other), amount: num(s.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const technicians: NamedCost[] = data.byTechnician
      .map((t) => ({ key: String(t.id), name: t.name, sub: categoryName(t.category), amount: num(t.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const suppliers: NamedCost[] = data.bySupplier
      .map((s) => ({ key: String(s.id), name: s.name, sub: "", amount: num(s.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const categories: NamedCost[] = data.byCategory
      .map((c) => ({ key: String(c.id ?? c.name), name: c.name, sub: "", amount: num(c.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const issues: IssueCost[] = data.tickets.byIssue
      .map((r) => ({ key: `${r.issueId ?? "none"}-${r.title}`, title: r.title, tickets: r.tickets, amount: num(r.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const tickets: TicketCost[] = data.tickets.topTickets.map((r) => ({
      key: String(r.ticketId),
      ticketId: r.ticketId,
      store: r.storeNumber ? storeName(r.storeNumber) : "—",
      title: r.title,
      amount: num(r.amount),
    }));
    const recurring: RecurringCost[] = data.tickets.recurringCostly.map((r, i) => ({
      key: `${r.storeNumber ?? "none"}-${r.issueId ?? "none"}-${i}`,
      store: r.storeNumber ? storeName(r.storeNumber) : "—",
      title: r.title,
      tickets: r.tickets,
      amount: num(r.amount),
    }));
    return { types, stores, technicians, suppliers, categories, issues, tickets, recurring };
  }, [data, storeName]);
}

type Costs = ReturnType<typeof useCosts>;

function MaintenanceCostsDialog({ data, costs, onClose }: { data: MaintenanceFinances; costs: Costs; onClose: () => void }) {
  const focus = useStoreFocus<StoreCost>();
  const spent = num(data.totals.spent);
  const perTicket = data.tickets.costPerTicketAvg === null ? null : num(data.tickets.costPerTicketAvg);
  const monthly = data.range?.trendBy === "month";
  const categories = useMemo(
    () => data.trend.map((p) => (monthly ? p.period : fmtDay(p.period))),
    [data.trend, monthly],
  );
  const series = useMemo(
    () =>
      costs.types.map((t) => ({
        name: t.label,
        data: data.trend.map((p) => num(p.byType[t.key as PaymentLineType])),
        color: t.color,
      })),
    [costs.types, data.trend],
  );
  const loadedStores = costs.stores.filter((s) => s.store !== "");

  const table = <T,>(rows: T[], columns: PagedColumn<T>[], rowKey: (r: T) => string, sort: string, search: (r: T) => string, empty: string) =>
    rows.length === 0 ? (
      <DialogEmpty>{empty}</DialogEmpty>
    ) : (
      <PagedTable size="lg" rows={rows} columns={columns} rowKey={rowKey} initialSort={sort} searchText={search} />
    );

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-5">
          <ReportBlock title={monthly ? "Spent per month" : "Spent per week"} description="By payment line type." className="lg:col-span-3">
            <TrendChart kind="bar" stacked categories={categories} series={series} format={fmt$Compact} tooltipFormat={fmt$2} />
          </ReportBlock>
          <ReportBlock title="By type" className="lg:col-span-2">
            <ShareBars
              size="lg"
              color={STORE_COLOR}
              total={spent}
              rows={costs.types.map((t) => ({ key: t.key, label: t.label, value: t.value, color: t.color, display: fmt$Compact(t.value), title: fmt$2(t.value) }))}
            />
            <V1SubLabel className="mb-1 mt-4">By category</V1SubLabel>
            <ShareBars
              size="lg"
              color={STORE_COLOR}
              limit={DIALOG_ROWS}
              total={spent}
              rows={costs.categories.map((c) => ({ key: c.key, label: c.name, value: c.amount, display: fmt$Compact(c.amount), title: fmt$2(c.amount) }))}
            />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content:
        loadedStores.length === 0 ? (
          <DialogEmpty>No maintenance spent at these stores in this range.</DialogEmpty>
        ) : (
          <PagedTable
            size="lg"
            rows={loadedStores}
            columns={STORE_COLUMNS}
            rowKey={(r) => r.key}
            initialSort="amount"
            searchText={storeSearch}
            onRowClick={focus.onRowClick}
            footerNote={focus.footerNote}
          />
        ),
    },
    {
      key: "technicians",
      label: "Technicians",
      content: table(costs.technicians, namedColumns("Technician"), (r) => r.key, "amount", nameSearch, "No technician was paid in this range."),
    },
    {
      key: "suppliers",
      label: "Suppliers",
      content: table(costs.suppliers, namedColumns("Supplier"), (r) => r.key, "amount", nameSearch, "No supplier was paid in this range."),
    },
    {
      key: "issues",
      label: "By issue",
      content: table(costs.issues, ISSUE_COLUMNS, (r) => r.key, "amount", titleSearch, "No ticket costs in this range."),
    },
    {
      key: "tickets",
      label: "Costliest tickets",
      content: (
        <div className="space-y-4">
          <ReportBlock title="Costliest tickets">
            {table(costs.tickets, TICKET_COLUMNS, (r) => r.key, "amount", titleSearch, "No ticket costs in this range.")}
          </ReportBlock>
          <ReportBlock title="Recurring and costly" description="The same issue at the same store, more than once.">
            {table(costs.recurring, RECURRING_COLUMNS, (r) => r.key, "amount", titleSearch, "No recurring costly issues in this range.")}
          </ReportBlock>
        </div>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Maintenance Costs"
      category="finance"
      stats={[
        { label: "Spent", value: fmt$Compact(spent), sub: fmt$2(spent), tone: "text-rose-600 dark:text-rose-400" },
        { label: "Payments", value: fmtNum(data.totals.payments), sub: plural(data.totals.lines, "line") },
        { label: "Per ticket", value: perTicket === null ? "—" : fmt$2(perTicket), sub: "average cost" },
        { label: "Technicians paid", value: fmtNum(costs.technicians.length) },
        {
          label: "Unpaid hours",
          value: fmtNum(Math.round(data.unpaid.paidMinutes / MINUTES_PER_HOUR)),
          sub: `${plural(data.unpaid.sessions, "session")} owed now`,
        },
        {
          label: "Unpaid purchases",
          value: fmt$Compact(num(data.unpaid.purchasesTotal)),
          sub: `${plural(data.unpaid.purchases, "purchase")} owed now`,
        },
      ]}
      tabs={tabs}
    />
  );
}

/** Maintenance spend at the loaded stores: total, payments, cost per ticket, by type and store. */
export function BrMaintenanceCostsCard({ data }: { data: MaintenanceFinances }) {
  const costs = useCosts(data);
  const [open, setOpen] = useState(false);
  const spent = num(data.totals.spent);
  const perTicket = data.tickets.costPerTicketAvg === null ? null : num(data.tickets.costPerTicketAvg);
  const empty = data.totals.payments === 0 && spent === 0;

  return (
    <V1Card
      reportId="br-maintenance-costs"
      title="Maintenance Costs"
      category="finance"
      period="R"
      span={2}
      headerNote={plural(data.totals.payments, "payment")}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={4}>
          <V1Metric label="Spent" value={<Money value={spent} />} accent="text-rose-600 dark:text-rose-400" size="sm" />
          <V1Metric label="Payments" value={fmtNum(data.totals.payments)} sub={plural(data.totals.lines, "line")} size="sm" />
          <V1Metric label="Per Ticket" value={perTicket === null ? "—" : <Money value={perTicket} />} size="sm" />
          <V1Metric
            label="Unpaid Now"
            value={<Money value={num(data.unpaid.purchasesTotal)} />}
            sub={`${plural(data.unpaid.sessions, "session")} · ${plural(data.unpaid.purchases, "purchase")}`}
            size="sm"
          />
        </V1MetricGrid>
        {empty ? (
          <V1Empty icon={Wrench}>No maintenance payments in this range.</V1Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <V1SubLabel className="mb-0.5">By type</V1SubLabel>
              <ShareBars
                total={spent}
                color={STORE_COLOR}
                limit={CARD_ROWS}
                rows={costs.types.map((t) => ({ key: t.key, label: t.label, value: t.value, color: t.color, display: fmt$Compact(t.value), title: fmt$2(t.value) }))}
              />
            </div>
            <div>
              <V1SubLabel className="mb-0.5">Top stores</V1SubLabel>
              <ShareBars
                total={spent}
                color={STORE_COLOR}
                limit={CARD_ROWS}
                rows={costs.stores.map((s) => ({ key: s.key, label: s.name, value: s.amount, display: fmt$Compact(s.amount), title: fmt$2(s.amount) }))}
              />
            </div>
          </div>
        )}
      </div>
      {open && <MaintenanceCostsDialog data={data} costs={costs} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
