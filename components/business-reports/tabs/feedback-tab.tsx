"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { StoreNav, type StoreNavItem } from "../store-nav";
import {
  ReportCard,
  Chip,
  Stars,
  TblWrap,
  TBL,
  TH,
  TD,
  NUM,
} from "@/components/wbr-reports/primitives";
import { fmt$2 } from "@/lib/mock/business-reports.mock";
import type {
  WbrBulkResponse,
  WbrBulkStore,
} from "@/types/business-reports.types";
import { TabEmpty, TabError } from "../states";

interface Props {
  data: WbrBulkResponse | null;
  error: string | null;
}

function approvalTone(approve: string | null): "ok" | "bad" | "warn" {
  if (!approve) return "warn";
  return approve.toLowerCase() === "yes" ? "ok" : "bad";
}

function StoreFeedbackBlock({ store }: { store: WbrBulkStore }) {
  const feedbacks = store.feedbacks ?? [];
  const complaints = store.complaints ?? [];
  const money_owed = store.money_owed ?? [];

  return (
    <ReportCard
      title={store.store_label}
      hint={`${feedbacks.length} feedback · ${complaints.length} complaints · ${money_owed.length} expenses`}
      className="lg:col-span-2"
      bodyClassName="grid gap-4 p-4"
    >
      {/* Employee feedback */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Employee Feedback
        </p>
        {feedbacks.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No feedback.</p>
        ) : (
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Feedback</th>
                  <th className={TH}>Valued</th>
                  <th className={TH}>Schedule</th>
                  <th className={TH}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id}>
                    <td className={TD}>
                      {f.first_name} {f.last_name}
                    </td>
                    <td className={cn(TD, "max-w-[280px] whitespace-normal")}>
                      {f.improvement_feedback}
                    </td>
                    <td className={TD}>
                      <Stars rating={f.valued_respected_appreciated_rating} />
                    </td>
                    <td className={TD}>
                      <Stars rating={f.work_schedule_satisfaction_rating} />
                    </td>
                    <td className={TD}>{f.submitted_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      {/* Complaints */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Complaints
        </p>
        {complaints.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No complaints.</p>
        ) : (
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>From</th>
                  <th className={TH}>Issue</th>
                  <th className={TH}>Suggestion</th>
                  <th className={TH}>Mgr Informed</th>
                  <th className={TH}>Date</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id}>
                    <td className={TD}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td className={cn(TD, "max-w-[240px] whitespace-normal")}>
                      {c.issue}
                    </td>
                    <td className={cn(TD, "max-w-[240px] whitespace-normal")}>
                      {c.suggestion}
                    </td>
                    <td className={TD}>
                      <Chip tone={c.manager_informed === "Yes" ? "ok" : "warn"}>
                        {c.manager_informed}
                      </Chip>
                    </td>
                    <td className={TD}>{c.complaint_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      {/* Money owed */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Money Owed
        </p>
        {money_owed.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No expenses.</p>
        ) : (
          <TblWrap>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Description</th>
                  <th className={cn(TH, NUM)}>Amount</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {money_owed.map((m) => (
                  <tr key={m.id}>
                    <td className={TD}>{m.employee_full_name}</td>
                    <td className={cn(TD, "max-w-[240px] whitespace-normal")}>
                      {m.expense_description}
                    </td>
                    <td className={cn(TD, NUM)}>
                      {fmt$2(Number(m.expenses_amount) || 0)}
                    </td>
                    <td className={TD}>{m.expense_date}</td>
                    <td className={TD}>
                      <Chip tone={approvalTone(m.approve)}>
                        {m.approve ?? "Pending"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>
    </ReportCard>
  );
}

export function FeedbackTab({ data, error }: Props) {
  const [sel, setSel] = useState<string>("");

  const stores = data?.stores ?? [];
  const navItems: StoreNavItem[] = useMemo(
    () =>
      stores.map((s) => {
        const count =
          (s.feedbacks?.length ?? 0) +
          (s.complaints?.length ?? 0) +
          (s.money_owed?.length ?? 0);
        return {
          key: String(s.store_number),
          code: String(s.store_number),
          label: s.store_label,
          badge: count,
          muted: count === 0,
        };
      }),
    [stores],
  );

  if (error) return <TabError message={error} />;
  if (stores.length === 0)
    return <TabEmpty message="No feedback data for the selected range." />;

  const keys = stores.map((s) => String(s.store_number));
  const effective =
    sel && (sel === "all" || keys.includes(sel)) ? sel : (keys[0] ?? "all");
  const shown =
    effective === "all"
      ? stores
      : stores.filter((s) => String(s.store_number) === effective);

  return (
    <div className="space-y-4">
      <StoreNav items={navItems} value={effective} onChange={setSel} />
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((store) => (
          <StoreFeedbackBlock key={store.store_number} store={store} />
        ))}
      </div>
    </div>
  );
}
