"use client";

import { Fragment, useMemo, useState } from "react";
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
  WbrBulkComplaint,
  WbrBulkResponse,
  WbrBulkStore,
} from "@/types/business-reports.types";
import { TabEmpty, TabError } from "../states";
import { ExpandChevronButton, useExpandedRows } from "../expandable-row";
import { CATEGORIES as REPORT_COLORS } from "@/components/dashboard-v1/category";
import { WbrDetailDialog, DetailField } from "@/components/dspr/wbr-detail-dialog";

const QUALITY = REPORT_COLORS.quality;
const FINANCE = REPORT_COLORS.finance;
const subLabel = (cat: typeof QUALITY) =>
  cn("text-[11px] font-semibold uppercase tracking-wide", cat.headerText);

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
  const moneyOwedExpand = useExpandedRows();
  const [openComplaint, setOpenComplaint] = useState<WbrBulkComplaint | null>(null);

  return (
    <ReportCard
      title={store.store_label}
      hint={`${feedbacks.length} feedback · ${complaints.length} complaints · ${money_owed.length} expenses`}
      className="min-w-0 lg:col-span-2"
      bodyClassName="grid min-w-0 gap-4 p-4"
      accent={QUALITY}
    >
      {/* Employee feedback */}
      <div className="min-w-0 space-y-2">
        <p className={subLabel(QUALITY)}>Employee Feedback</p>
        {feedbacks.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No feedback.</p>
        ) : (
          <TblWrap tall>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Entry #</th>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Store</th>
                  <th className={TH}>Feedback</th>
                  <th className={TH}>Valued</th>
                  <th className={TH}>Schedule</th>
                  <th className={TH}>Submitted</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id}>
                    <td className={TD}>{f.external_entry_number}</td>
                    <td className={TD}>
                      {f.first_name} {f.last_name}
                    </td>
                    <td className={TD}>{f.store_label}</td>
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
                    <td className={TD}>{f.created_at.slice(0, 10)}</td>
                    <td className={TD}>{f.updated_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      {/* Complaints */}
      <div className="min-w-0 space-y-2">
        <p className={subLabel(QUALITY)}>Complaints</p>
        {complaints.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No complaints.</p>
        ) : (
          <TblWrap tall>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Entry #</th>
                  <th className={TH}>From</th>
                  <th className={TH}>Store</th>
                  <th className={TH}>Contact</th>
                  <th className={TH}>Issue</th>
                  <th className={TH}>Suggestion</th>
                  <th className={TH}>Mgr Informed</th>
                  <th className={TH}>Complaint Date</th>
                  <th className={TH}>Submitted</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setOpenComplaint(c)}
                  >
                    <td className={TD}>{c.external_entry_number}</td>
                    <td className={TD}>
                      {c.first_name} {c.last_name}
                    </td>
                    <td className={TD}>{c.store_label}</td>
                    <td className={TD}>
                      <span className="flex flex-col text-[11px] text-muted-foreground">
                        <span>{c.phone}</span>
                        <span>{c.email}</span>
                      </span>
                    </td>
                    <td className={cn(TD, "max-w-[240px] truncate")}>
                      {c.issue}
                    </td>
                    <td className={cn(TD, "max-w-[240px] truncate")}>
                      {c.suggestion}
                    </td>
                    <td className={TD}>
                      <Chip tone={c.manager_informed === "Yes" ? "ok" : "warn"}>
                        {c.manager_informed}
                      </Chip>
                    </td>
                    <td className={TD}>{c.complaint_date.slice(0, 10)}</td>
                    <td className={TD}>{c.submitted_at.slice(0, 10)}</td>
                    <td className={TD}>{c.created_at.slice(0, 10)}</td>
                    <td className={TD}>{c.updated_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TblWrap>
        )}
      </div>

      <WbrDetailDialog
        open={!!openComplaint}
        onOpenChange={(o) => !o && setOpenComplaint(null)}
        title={
          openComplaint
            ? `${openComplaint.first_name} ${openComplaint.last_name}`
            : ""
        }
        badgeText={openComplaint?.store_label}
      >
        {openComplaint && (
          <div className="space-y-1.5">
            <DetailField label="Entry #" value={openComplaint.external_entry_number} />
            <DetailField label="Phone" value={openComplaint.phone} />
            <DetailField label="Email" value={openComplaint.email} />
            <DetailField label="Mgr Informed" value={openComplaint.manager_informed} />
            <DetailField label="Complaint Date" value={openComplaint.complaint_date.slice(0, 10)} />
            <DetailField label="Issue" value={openComplaint.issue} wrap />
            <DetailField label="Suggestion" value={openComplaint.suggestion} wrap />
          </div>
        )}
      </WbrDetailDialog>

      {/* Money owed */}
      <div className="min-w-0 space-y-2">
        <p className={subLabel(FINANCE)}>Money Owed</p>
        {money_owed.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No expenses.</p>
        ) : (
          <TblWrap tall>
            <table className={TBL}>
              <thead>
                <tr>
                  <th className={TH}>Form ID</th>
                  <th className={TH}>Employee</th>
                  <th className={TH}>Store</th>
                  <th className={TH}>Description</th>
                  <th className={cn(TH, NUM)}>Amount</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {money_owed.map((m) => {
                  const open = moneyOwedExpand.isExpanded(String(m.id));
                  return (
                    <Fragment key={m.id}>
                      <tr>
                        <td className={TD}>
                          <ExpandChevronButton
                            expanded={open}
                            onClick={() => moneyOwedExpand.toggle(String(m.id))}
                          />
                          {m.form_id}
                        </td>
                        <td className={TD}>{m.employee_full_name}</td>
                        <td className={TD}>{m.store_label}</td>
                        <td className={cn(TD, "max-w-[240px] whitespace-normal")}>
                          {m.expense_description}
                        </td>
                        <td className={cn(TD, NUM)}>
                          {fmt$2(Number(m.expenses_amount) || 0)}
                        </td>
                        <td className={TD}>{m.expense_date.slice(0, 10)}</td>
                        <td className={TD}>
                          <Chip tone={approvalTone(m.approve)}>
                            {m.approve ?? "Pending"}
                          </Chip>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} className="bg-muted/20 p-3">
                            <div className="grid gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
                              <p>
                                <span className="text-muted-foreground">Store Manager: </span>
                                {m.store_manager_full_name}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Manager Consulted: </span>
                                {m.manager_consulted_full_name}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Group Manager: </span>
                                {m.group_manager_full_name}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Notes: </span>
                                {m.notes ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Rejection Reason: </span>
                                {m.rejection_reason ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">BI Reviewer: </span>
                                {m.bi_full_name ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">BI Approved: </span>
                                {m.bi_approve ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">BI Notes: </span>
                                {m.bi_notes ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">BI Rejection Reason: </span>
                                {m.bi_rejection_reason ?? "—"}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Created: </span>
                                {m.created_at.slice(0, 10)}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Updated: </span>
                                {m.updated_at.slice(0, 10)}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start">
      <StoreNav
        items={navItems}
        value={effective}
        onChange={setSel}
        className="lg:sticky lg:top-0"
      />
      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-2">
        {shown.map((store) => (
          <StoreFeedbackBlock key={store.store_number} store={store} />
        ))}
      </div>
    </div>
  );
}
