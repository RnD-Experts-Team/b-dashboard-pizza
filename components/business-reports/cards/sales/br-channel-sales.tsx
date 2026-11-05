"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { CHANNEL_COLORS } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport, useSection } from "@/components/business-reports/report-context";
import {
  RD_NUM,
  RD_TBL,
  RD_TD,
  RD_TH,
  ReportBlock,
  ReportDialog,
  type ReportStat,
} from "@/components/business-reports/report-dialog";
import { compareText, fmt$, fmtNum, fmtPct, fmtRange, share, weekLabel } from "@/components/business-reports/report-format";
import { BarList, Money, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { ChannelKey, ChannelSplit, SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrChannelSalesCard — V1 "Channel Sales" over the range: sales and orders
 *  per channel (sales section) plus customers and the website/mobile
 *  in-store vs delivery split (orders section). Renders on sales alone; the
 *  orders-only cells fill in when the orders section lands. Expand: the
 *  channel mix, every week and every store by channel.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_CHANNEL_SALES_SPAN: V1Span = 2;

interface RowDef {
  key: string;
  label: string;
  /** Sales from the sales section, or null when it comes from the orders split. */
  sales: (t: SalesMetrics) => number | null;
  splitSales?: (s: ChannelSplit) => number;
  orders: (t: SalesMetrics) => number | null;
  customers: (s: ChannelSplit) => number | null;
  bold?: boolean;
  indent?: boolean;
}

const channelRow = (ch: ChannelKey, label: string, customers: (s: ChannelSplit) => number | null): RowDef => ({
  key: ch,
  label,
  sales: (t) => t[`${ch}_sales`],
  orders: (t) => t[`${ch}_orders`],
  customers,
});

const ROWS: RowDef[] = [
  channelRow("phone", "Phone", (s) => s.customers_phone),
  {
    ...channelRow("website", "Website", (s) => s.website_in_store_customers + s.website_delivery_customers),
    bold: true,
  },
  {
    key: "website_in_store",
    label: "In-store",
    sales: () => null,
    splitSales: (s) => s.website_in_store,
    orders: () => null,
    customers: (s) => s.website_in_store_customers,
    indent: true,
  },
  {
    key: "website_delivery",
    label: "Delivery",
    sales: () => null,
    splitSales: (s) => s.website_delivery,
    orders: () => null,
    customers: (s) => s.website_delivery_customers,
    indent: true,
  },
  {
    ...channelRow("mobile", "Mobile", (s) => s.mobile_in_store_customers + s.mobile_delivery_customers),
    bold: true,
  },
  {
    key: "mobile_in_store",
    label: "In-store",
    sales: () => null,
    splitSales: (s) => s.mobile_in_store,
    orders: () => null,
    customers: (s) => s.mobile_in_store_customers,
    indent: true,
  },
  {
    key: "mobile_delivery",
    label: "Delivery",
    sales: () => null,
    splitSales: (s) => s.mobile_delivery,
    orders: () => null,
    customers: (s) => s.mobile_delivery_customers,
    indent: true,
  },
  channelRow("call_center", "Call Center", (s) => s.customers_call_center),
  channelRow("drive_thru", "Drive-Thru", (s) => s.customers_drive_thru),
  channelRow("doordash", "DoorDash", (s) => s.customers_doordash),
  channelRow("ubereats", "UberEats", (s) => s.customers_ubereats),
  channelRow("grubhub", "Grubhub", (s) => s.customers_grubhub),
  {
    key: "register",
    label: "Register",
    sales: (t) => t.register_sales,
    orders: () => null,
    customers: () => null,
    bold: true,
  },
];

/** The top-level channels (no website/mobile split), for the mix, weeks and stores. */
const CHANNELS: { id: keyof typeof CHANNEL_COLORS; label: string; sales: (m: SalesMetrics) => number }[] = [
  { id: "register", label: "Register", sales: (m) => m.register_sales },
  { id: "phone", label: "Phone", sales: (m) => m.phone_sales },
  { id: "website", label: "Website", sales: (m) => m.website_sales },
  { id: "mobile", label: "Mobile", sales: (m) => m.mobile_sales },
  { id: "call_center", label: "Call Center", sales: (m) => m.call_center_sales },
  { id: "drive_thru", label: "Drive-Thru", sales: (m) => m.drive_thru_sales },
  { id: "doordash", label: "DoorDash", sales: (m) => m.doordash_sales },
  { id: "ubereats", label: "UberEats", sales: (m) => m.ubereats_sales },
  { id: "grubhub", label: "Grubhub", sales: (m) => m.grubhub_sales },
];

interface CellRow {
  key: string;
  label: string;
  sales: number | null;
  orders: number | null;
  customers: number | null;
  bold?: boolean;
  indent?: boolean;
}

type WeekRow = SalesWeek & { label: string };
type StoreRow = SalesMetrics & { store: string };

export function BrChannelSalesCard({ data }: { data: SalesSection }) {
  const [open, setOpen] = useState(false);
  const orders = useSection("orders");
  const split = orders.data?.channels.totals ?? null;
  const pending = orders.loading && !split;
  const t = data.totals;

  const rows = useMemo<CellRow[]>(
    () =>
      ROWS.map((r) => ({
        key: r.key,
        label: r.label,
        sales: r.sales(t) ?? (split && r.splitSales ? r.splitSales(split) : null),
        orders: r.orders(t),
        customers: split ? r.customers(split) : null,
        bold: r.bold,
        indent: r.indent,
      })),
    [t, split],
  );

  const placeholder = pending ? (
    <Loader2 className="ms-auto h-3 w-3 animate-spin text-muted-foreground" aria-label="Loading" />
  ) : (
    <span className="text-muted-foreground">—</span>
  );

  return (
    <V1Card
      title="Channel Sales"
      category="sales"
      period="R"
      span={BR_CHANNEL_SALES_SPAN}
      bodyClassName="px-0"
      headerNote={orders.error ? "Customer split unavailable" : undefined}
      onExpand={() => setOpen(true)}
    >
      <table className={V1_TBL}>
        <thead>
          <tr>
            <th className={V1_TH}>Channel</th>
            <th className={cn(V1_TH, V1_NUM)}>Sales</th>
            <th className={cn(V1_TH, V1_NUM)}>Orders</th>
            <th className={cn(V1_TH, V1_NUM)}>Customers</th>
            <th className={cn(V1_TH, V1_NUM)}>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={cn(V1_TD, r.indent && "ps-5 text-muted-foreground", r.bold && "font-semibold")}>
                {r.label}
              </td>
              <td className={cn(V1_TD, V1_NUM, r.bold && "font-semibold")}>
                {r.sales === null ? placeholder : <Money value={r.sales} />}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                {r.orders === null ? <span className="text-muted-foreground">—</span> : fmtNum(r.orders)}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                {r.customers === null ? placeholder : fmtNum(r.customers)}
              </td>
              <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                {r.sales === null ? "—" : fmtPct(share(r.sales, t.sales))}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={V1_TD}>Total</td>
            <td className={cn(V1_TD, V1_NUM)}>
              <Money value={t.sales} />
            </td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtNum(t.total_orders)}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtNum(t.customer_count)}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtPct(share(t.sales, t.sales))}</td>
          </tr>
        </tbody>
      </table>

      {open && (
        <ChannelDialog data={data} rows={rows} placeholder={placeholder} onClose={() => setOpen(false)} />
      )}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function channelColumns<T extends SalesMetrics>(): PagedColumn<T>[] {
  return [
    { key: "sales", header: "Total", numeric: true, sortValue: (r) => r.sales, render: (r) => <span className="font-semibold">{fmt$(r.sales)}</span> },
    ...CHANNELS.map<PagedColumn<T>>((c) => ({
      key: c.id,
      header: c.label,
      numeric: true,
      sortValue: (r) => c.sales(r),
      render: (r) => (
        <span title={`${fmtPct(share(c.sales(r), r.sales))} of sales`}>{fmt$(c.sales(r))}</span>
      ),
    })),
  ];
}

function ChannelDialog({
  data,
  rows,
  placeholder,
  onClose,
}: {
  data: SalesSection;
  rows: CellRow[];
  placeholder: ReactNode;
  onClose: () => void;
}) {
  const { storeName } = useReport();
  const t = data.totals;

  const mix = useMemo<BarRow[]>(
    () =>
      CHANNELS.map((c) => ({
        key: c.id,
        label: c.label,
        value: c.sales(t),
        display: fmt$(c.sales(t)),
        sub: fmtPct(share(c.sales(t), t.sales)),
        color: CHANNEL_COLORS[c.id],
      })).sort((a, b) => b.value - a.value),
    [t],
  );

  const weeks = useMemo<WeekRow[]>(
    () =>
      [...data.by_week]
        .sort((a, b) => compareText(a.week_start, b.week_start))
        .map((w) => ({ ...w, label: weekLabel(w) })),
    [data.by_week],
  );
  const weekCols = useMemo<PagedColumn<WeekRow>[]>(
    () => [
      {
        key: "week",
        header: "Week",
        sortValue: (r) => r.week_start,
        render: (r) => (
          <div className="leading-tight">
            <div className="font-semibold">{r.label}</div>
            <div className="text-xs text-muted-foreground">{fmtRange(r.start, r.end)}</div>
          </div>
        ),
      },
      ...channelColumns<WeekRow>(),
    ],
    [],
  );

  const stores = useMemo<StoreRow[]>(() => Object.entries(data.by_store).map(([store, m]) => ({ ...m, store })), [data.by_store]);
  const storeCols = useMemo<PagedColumn<StoreRow>[]>(
    () => [storeColumn<StoreRow>(storeName), ...channelColumns<StoreRow>()],
    [storeName],
  );

  const digital = t.website_sales + t.mobile_sales;
  const thirdParty = t.doordash_sales + t.ubereats_sales + t.grubhub_sales;
  const stats: ReportStat[] = [
    { label: "Sales", value: fmt$(t.sales), sub: `${fmtNum(t.total_orders)} orders` },
    { label: "Register", value: fmt$(t.register_sales), sub: `${fmtPct(share(t.register_sales, t.sales))} of sales` },
    { label: "Phone", value: fmt$(t.phone_sales), sub: `${fmtPct(share(t.phone_sales, t.sales))} of sales` },
    { label: "Website + Mobile", value: fmt$(digital), sub: `${fmtPct(share(digital, t.sales))} of sales` },
    { label: "Delivery partners", value: fmt$(thirdParty), sub: `${fmtPct(share(thirdParty, t.sales))} · DoorDash, UberEats, Grubhub` },
    { label: "Customers", value: fmtNum(t.customer_count) },
  ];

  const tabs = [
    {
      key: "channels",
      label: "Channels",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportBlock title="Channel mix" description="Sales by channel, largest first">
            <BarList rows={mix} color={CHANNEL_COLORS.register} />
          </ReportBlock>
          <ReportBlock title="Channel detail" description="Customers and the website/mobile split come from the orders data">
            <table className={RD_TBL}>
              <thead>
                <tr>
                  <th className={RD_TH}>Channel</th>
                  <th className={cn(RD_TH, RD_NUM)}>Sales</th>
                  <th className={cn(RD_TH, RD_NUM)}>Orders</th>
                  <th className={cn(RD_TH, RD_NUM)}>Customers</th>
                  <th className={cn(RD_TH, RD_NUM)}>Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className={cn(RD_TD, r.indent && "ps-8 text-muted-foreground", r.bold && "font-semibold")}>{r.label}</td>
                    <td className={cn(RD_TD, RD_NUM, r.bold && "font-semibold")}>{r.sales === null ? placeholder : fmt$(r.sales)}</td>
                    <td className={cn(RD_TD, RD_NUM)}>{r.orders === null ? "—" : fmtNum(r.orders)}</td>
                    <td className={cn(RD_TD, RD_NUM)}>{r.customers === null ? placeholder : fmtNum(r.customers)}</td>
                    <td className={cn(RD_TD, RD_NUM, "text-muted-foreground")}>
                      {r.sales === null ? "—" : fmtPct(share(r.sales, t.sales))}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className={RD_TD}>Total</td>
                  <td className={cn(RD_TD, RD_NUM)}>{fmt$(t.sales)}</td>
                  <td className={cn(RD_TD, RD_NUM)}>{fmtNum(t.total_orders)}</td>
                  <td className={cn(RD_TD, RD_NUM)}>{fmtNum(t.customer_count)}</td>
                  <td className={cn(RD_TD, RD_NUM)}>{fmtPct(share(t.sales, t.sales))}</td>
                </tr>
              </tbody>
            </table>
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: (
        <ReportBlock title="Every week by channel" description="Hover a value for its share of that week's sales">
          <PagedTable size="lg" rows={weeks} columns={weekCols} rowKey={(r) => r.week_start} initialSort="week" initialDir="desc" />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store by channel" description="Hover a value for its share of the store's sales">
          <PagedTable
            size="lg"
            rows={stores}
            columns={storeCols}
            rowKey={(r) => r.store}
            initialSort="sales"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
          />
        </ReportBlock>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Channel Sales"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
