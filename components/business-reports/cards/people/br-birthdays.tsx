"use client";

import { useMemo, useState } from "react";
import { Cake } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtNumber } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import { cn } from "@/lib/utils";
import type { LaborBlock, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, SeeAll, safeDay } from "./br-people-kit";
import { isValid, parseISO } from "date-fns";
import { businessWeekStart } from "@/lib/utils/business-week";
import { compareText, weekLabel } from "../../report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  Birthdays — V1's birthday card for every birthday inside the range, with
 *  the store each employee works at. Long lists continue in the dialog.
 * ────────────────────────────────────────────────────────────────────────── */

type Birthday = NonNullable<LaborBlock["birthdays"]>[number];

const AVATAR_COLORS = ["bg-pink-500", "bg-violet-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-orange-500"];
const INITIALS = 2;
const CARD_PREVIEW = 20;

interface StoreRow {
  store: string;
  count: number;
  next: Birthday | null;
}

/** "Wk 43" of the business week the day falls in. */
function weekOfDay(day: string): string {
  return isValid(parseISO(day)) ? weekLabel({ week_start: businessWeekStart(day) }) : DASH;
}

function birthdayKey(b: Birthday): string {
  return `${b.store}-${b.employee_id}-${b.date}`;
}

function BirthdaysDialog({ birthdays, onClose }: { birthdays: Birthday[]; onClose: () => void }) {
  const { storeName } = useReport();
  const [stores, setStores] = useState<string[]>([]);
  const filtered = useMemo(() => inStores(birthdays, stores, (b) => b.store), [birthdays, stores]);

  const columns = useMemo<PagedColumn<Birthday>[]>(
    () => [
      { key: "date", header: "Date", render: (b) => safeDay(b.date), sortValue: (b) => b.date },
      { key: "week", header: "Week", render: (b) => weekOfDay(b.date), sortValue: (b) => b.date },
      { key: "name", header: "Employee", render: (b) => <span className="font-medium">{b.name}</span>, sortValue: (b) => b.name },
      { key: "store", header: "Store", render: (b) => storeName(b.store), sortValue: (b) => storeName(b.store) },
      { key: "position", header: "Position", render: (b) => b.position ?? DASH, sortValue: (b) => b.position },
      { key: "age", header: "Turns", numeric: true, render: (b) => b.turns_age, sortValue: (b) => b.turns_age },
    ],
    [storeName],
  );

  const storeRows = useMemo<StoreRow[]>(() => {
    const map = birthdays.reduce<Map<string, StoreRow>>((m, b) => {
      const row = m.get(b.store) ?? { store: b.store, count: 0, next: null };
      m.set(b.store, { ...row, count: row.count + 1, next: row.next ?? b });
      return m;
    }, new Map());
    return [...map.values()];
  }, [birthdays]);

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (r) => <span className="font-medium">{storeName(r.store)}</span>, sortValue: (r) => storeName(r.store) },
      { key: "count", header: "Birthdays", numeric: true, render: (r) => fmtNumber(r.count), sortValue: (r) => r.count },
      { key: "next", header: "First in range", render: (r) => (r.next ? `${r.next.name} · ${safeDay(r.next.date)}` : DASH), sortValue: (r) => r.next?.date },
    ],
    [storeName],
  );

  const first = birthdays[0];
  const stats: ReportStat[] = [
    { label: "Birthdays", value: fmtNumber(birthdays.length) },
    { label: "Stores", value: fmtNumber(storeRows.length) },
    { label: "First", value: first ? safeDay(first.date) : DASH, sub: first ? `${first.name} · ${storeName(first.store)}` : undefined },
  ];
  const search = (b: Birthday) => `${b.name} ${storeName(b.store)} ${b.position ?? ""}`;
  const storeSearch = (r: StoreRow) => storeName(r.store);

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Birthdays"
      category="people"
      stats={stats}
      tabs={[
        {
          key: "list",
          label: `All birthdays (${birthdays.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <StoreChecklist value={stores} onChange={setStores} />
              <PagedTable
                key={stores.join(",")}
                size="lg"
                rows={filtered}
                columns={columns}
                rowKey={birthdayKey}
                initialSort="date"
                initialDir="asc"
                searchText={search}
                searchPlaceholder="Search employees…"
              />
            </div>
          ),
        },
        {
          key: "stores",
          label: `By store (${storeRows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={storeRows}
              columns={storeColumns}
              rowKey={(r) => r.store}
              initialSort="count"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
      ]}
    />
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join("")
    .slice(0, INITIALS);
}

export function BrBirthdays({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const [open, setOpen] = useState(false);
  const birthdays = useMemo(
    () => [...(data.combined.birthdays ?? [])].sort((a, b) => compareText(a.date, b.date)),
    [data.combined.birthdays],
  );
  const preview = birthdays.slice(0, CARD_PREVIEW);

  return (
    <V1Card
      reportId="br-birthdays"
      title="Birthdays"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      headerNote={birthdays.length > 0 ? birthdays.length.toLocaleString() : undefined}
      onExpand={birthdays.length > 0 ? () => setOpen(true) : undefined}
    >
      {birthdays.length === 0 ? (
        <V1Empty icon={Cake}>No birthdays in this range</V1Empty>
      ) : (
        <div className="space-y-1">
          {preview.map((b, idx) => (
            <div
              key={birthdayKey(b)}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2 py-1"
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
                  AVATAR_COLORS[idx % AVATAR_COLORS.length],
                )}
              >
                {initials(b.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold">{b.name}</p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {storeName(b.store)}
                  {b.position ? ` · ${b.position}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[10px] font-semibold tabular-nums text-violet-600 dark:text-violet-400">{safeDay(b.date)}</p>
                <p className="text-[9px] text-muted-foreground">turns {b.turns_age}</p>
              </div>
            </div>
          ))}
          {birthdays.length > CARD_PREVIEW && <SeeAll count={birthdays.length} onClick={() => setOpen(true)} />}
        </div>
      )}

      {open && <BirthdaysDialog birthdays={birthdays} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
