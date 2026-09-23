"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatHours, formatMoney } from "@/lib/daily-pay/money";
import {
  parseRevisionSnapshot,
  snapshotNumber,
  type ParsedSnapshot,
} from "@/lib/daily-pay/revision-snapshot";
import type {
  ApiDailyPaySnapshotLineV1,
  ApiDailyPaySnapshotLineV2,
  ApiDailyPaySnapshotPaymentV2,
  DailyPayRevision,
} from "@/types/daily-pay.types";
import type { CatalogTechnician } from "@/types/maintenance-tickets.types";
import type { DailyPayStoreOption } from "@/lib/hooks/use-daily-pay";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Revision snapshot viewer                                                 */
/*                                                                            */
/*  Snapshots are RAW snake_case API JSON — never run through the service     */
/*  transformers — and they hold ids rather than names, so this component     */
/*  resolves ids against the catalogs it is handed rather than fetching.      */
/*                                                                            */
/*  Both schema versions live in history permanently, because old snapshots   */
/*  are never rewritten. Rendering only v2 would blank out every              */
/*  pre-migration revision, so all three branches are real.                  */
/* ────────────────────────────────────────────────────────────────────────── */

const TBL = "w-full text-[11px] tabular-nums";
const TH = "px-1.5 py-1 text-start text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";
const TD = "px-1.5 py-1 border-t border-border";

interface Catalogs {
  technicians: CatalogTechnician[];
  stores: DailyPayStoreOption[];
}

function technicianName(id: number | null | undefined, { technicians }: Catalogs): string {
  if (id == null) return "—";
  return technicians.find((t) => t.id === id)?.name ?? `Technician #${id}`;
}

function storeLabel(
  storeId: number | null | undefined,
  otherStore: string | null | undefined,
  { stores }: Catalogs
): string {
  if (otherStore) return otherStore;
  if (storeId == null) return "—";
  return stores.find((s) => s.id === storeId)?.storeNumber ?? `Store #${storeId}`;
}

function money(value: unknown): string {
  return formatMoney(snapshotNumber(value));
}

function hours(value: unknown): string {
  return formatHours(snapshotNumber(value));
}

/* ── v2 ───────────────────────────────────────────────────────────────────── */

function PaymentBlockV2({
  payment,
  catalogs,
}: {
  payment: ApiDailyPaySnapshotPaymentV2;
  catalogs: Catalogs;
}) {
  const lines: ApiDailyPaySnapshotLineV2[] = payment.lines ?? [];

  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold">{technicianName(payment.technician_id, catalogs)}</p>
        {payment.total_amount != null && (
          <p className="text-xs font-semibold tabular-nums">{money(payment.total_amount)}</p>
        )}
      </div>

      <p className="mb-2 text-[10px] text-muted-foreground">
        Rate {money(payment.hourly_payment_rate)} · Gas {money(payment.gas)} · Additional owed{" "}
        {money(payment.money_owed)}
        {payment.lump_sum != null && ` · Lump sum ${money(payment.lump_sum)}`}
      </p>

      {lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No store lines.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={TH}>Hours</th>
                <th className={TH}>Rate</th>
                <th className={TH}>Lump</th>
                <th className={TH}>Gas</th>
                <th className={TH}>Add&apos;l owed</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className={TD}>
                    <span className="flex items-center gap-1">
                      {storeLabel(line.store_id, line.other_store, catalogs)}
                      {line.other_store && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                          Other
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className={TD}>
                    {hours(line.total_working_hours)}
                    {line.hours_overridden && (
                      <span className="ms-1 text-[9px] text-muted-foreground">ovr</span>
                    )}
                  </td>
                  <td className={TD}>{money(line.hourly_payment_rate)}</td>
                  <td className={TD}>{money(line.lump_sum)}</td>
                  <td className={TD}>{money(line.gas)}</td>
                  <td className={TD}>{money(line.money_owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── v1 ───────────────────────────────────────────────────────────────────── */

function LinesTableV1({
  lines,
  catalogs,
}: {
  lines: ApiDailyPaySnapshotLineV1[];
  catalogs: Catalogs;
}) {
  if (lines.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No lines.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className={TBL}>
        <thead>
          <tr>
            <th className={TH}>Technician</th>
            <th className={TH}>Store</th>
            <th className={TH}>Hours</th>
            <th className={TH}>Break</th>
            <th className={TH}>Travel</th>
            <th className={TH}>Rate</th>
            <th className={TH}>Gas</th>
            {/* The one place `invoices` still legitimately renders: this is
                historical data, and hiding it would make the migration look
                lossy to whoever is reading the audit trail. */}
            <th className={TH}>Invoices</th>
            <th className={TH}>Money owed</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td className={TD}>{technicianName(line.technician_id, catalogs)}</td>
              <td className={TD}>{storeLabel(line.store_id, null, catalogs)}</td>
              <td className={TD}>{hours(line.total_working_hours)}</td>
              <td className={TD}>{hours(line.total_break_time)}</td>
              <td className={TD}>{hours(line.travel_time)}</td>
              <td className={TD}>{money(line.hourly_payment_rate)}</td>
              <td className={TD}>{money(line.gas)}</td>
              <td className={TD}>{money(line.invoices)}</td>
              <td className={TD}>{money(line.money_owed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Entry point ──────────────────────────────────────────────────────────── */

interface DailyPayRevisionViewerProps {
  revision: DailyPayRevision;
  technicians: CatalogTechnician[];
  stores: DailyPayStoreOption[];
}

export function DailyPayRevisionViewer({
  revision,
  technicians,
  stores,
}: DailyPayRevisionViewerProps) {
  const parsed: ParsedSnapshot = parseRevisionSnapshot(revision.schemaVersion, revision.snapshot);
  const catalogs: Catalogs = { technicians, stores };

  if (parsed.kind === "unknown") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">
          Unrecognised snapshot format — showing raw data.
        </p>
        <ScrollArea className="max-h-64 rounded-md border bg-muted/30">
          <pre className="p-2 text-[10px] leading-relaxed">
            {JSON.stringify(parsed.raw, null, 2)}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {parsed.date && (
          <p className="text-[11px] text-muted-foreground">Workday {parsed.date}</p>
        )}
        {parsed.kind === "v1" && (
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal">
            Legacy format (v1)
          </Badge>
        )}
      </div>

      {parsed.kind === "v1" ? (
        <LinesTableV1 lines={parsed.lines} catalogs={catalogs} />
      ) : parsed.payments.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No payments in this revision.</p>
      ) : (
        <div className="space-y-2">
          {parsed.payments.map((payment, i) => (
            <PaymentBlockV2 key={i} payment={payment} catalogs={catalogs} />
          ))}
        </div>
      )}
    </div>
  );
}
