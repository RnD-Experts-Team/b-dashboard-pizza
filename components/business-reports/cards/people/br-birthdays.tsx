"use client";

import { useMemo, useState } from "react";
import { Cake } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { DASH } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { cn } from "@/lib/utils";
import type { LaborBlock, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, SeeAll, safeDay } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Birthdays — V1's birthday card for every birthday inside the range, with
 *  the store each employee works at. Long lists continue in the dialog.
 * ────────────────────────────────────────────────────────────────────────── */

type Birthday = NonNullable<LaborBlock["birthdays"]>[number];

const AVATAR_COLORS = ["bg-pink-500", "bg-violet-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-orange-500"];
const INITIALS = 2;
const CARD_PREVIEW = 20;

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
    () => [...(data.combined.birthdays ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [data.combined.birthdays],
  );
  const preview = birthdays.slice(0, CARD_PREVIEW);

  const columns = useMemo<PagedColumn<Birthday>[]>(
    () => [
      { key: "date", header: "Date", render: (b) => safeDay(b.date), sortValue: (b) => b.date },
      { key: "name", header: "Employee", render: (b) => <span className="font-medium">{b.name}</span>, sortValue: (b) => b.name },
      { key: "store", header: "Store", render: (b) => storeName(b.store), sortValue: (b) => storeName(b.store) },
      { key: "position", header: "Position", render: (b) => b.position ?? DASH, sortValue: (b) => b.position },
      { key: "age", header: "Turns", numeric: true, render: (b) => b.turns_age, sortValue: (b) => b.turns_age },
    ],
    [storeName],
  );

  return (
    <V1Card
      reportId="br-birthdays"
      title="Birthdays"
      category="people"
      period="R"
      span={1}
      height={ROW_CARD_HEIGHT}
      headerNote={birthdays.length > 0 ? birthdays.length.toLocaleString() : undefined}
      onExpand={birthdays.length > CARD_PREVIEW ? () => setOpen(true) : undefined}
    >
      {birthdays.length === 0 ? (
        <V1Empty icon={Cake}>No birthdays in this range</V1Empty>
      ) : (
        <div className="space-y-1">
          {preview.map((b, idx) => (
            <div
              key={`${b.store}-${b.employee_id}-${b.date}`}
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

      {open && (
        <WbrDetailDialog open={open} onOpenChange={setOpen} title="Birthdays" badgeText={`${birthdays.length} in range`} className="sm:max-w-3xl">
          <PagedTable rows={birthdays} columns={columns} rowKey={(b) => `${b.store}-${b.employee_id}-${b.date}`} initialSort="date" initialDir="asc" />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
