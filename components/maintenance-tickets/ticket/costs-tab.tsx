"use client";

import Link from "next/link";
import { Download, FileText, Paperclip, ShoppingBag, Stamp, Wallet, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decimalOr0, formatMoney } from "@/lib/maintenance/money";
import { APPROVAL_DECISIONS, PAYMENT_LINE_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { TicketIssueV2 } from "@/types/maintenance-v2";
import { AttachmentGallery } from "../attachment-gallery";
import { LocalTimestamp } from "../local-timestamp";
import { formatDay } from "./format";

function BigNumber({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", strong && "border-primary/40 bg-primary/5")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-2xl font-semibold tabular-nums", strong && "text-primary")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Block({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{text}</p>;
}

const DECISION_TONE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

export function CostsTab({
  issue,
  canPay,
  onRecordPayment,
}: {
  issue: TicketIssueV2;
  canPay: boolean;
  onRecordPayment: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const c = issue.costs;
  const paymentHref = (id: number) => `/${locale}/dashboard/maintenance-payments?payment=${id}`;
  const approvals = issue.approvals.filter((a) => !a.mistaken).sort((a, b) => b.id - a.id);
  const latest = approvals[0] ?? null;
  const pendingLevel = issue.status.value === "waiting_approval" ? issue.workflow?.approvalLevelFor ?? null : null;
  const unpaid = issue.purchases.filter((p) => !p.mistaken && !p.paid);
  const invoices = issue.payments.filter((p) => p.hasInvoice || p.invoiceNumber || p.invoices?.length);
  // A payment can name the issue on several lines: each file once, then payments with only a number (or no files sent).
  const seenFiles = new Set<number>();
  const invoiceFiles = invoices.flatMap((p) =>
    (p.invoices ?? [])
      .filter((file) => (seenFiles.has(file.id) ? false : (seenFiles.add(file.id), true)))
      .map((file) => ({ file, payment: p })),
  );
  const filedPayments = new Set(invoiceFiles.map((f) => f.payment.paymentId));
  const seenPayments = new Set<number>();
  const numberOnly = invoices.filter((p) =>
    filedPayments.has(p.paymentId) || seenPayments.has(p.paymentId) ? false : (seenPayments.add(p.paymentId), true),
  );
  const stockValue = decimalOr0(c?.stockUsedValue);
  const otherSpend = decimalOr0(c?.inspection) + decimalOr0(c?.gas) + decimalOr0(c?.other);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canPay ? (
          <Button variant="outline" size="sm" onClick={onRecordPayment}>
            <Wallet className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t("costs.recordPayment")}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <BigNumber
          label={t("costs.estimated")}
          value={formatMoney(c?.estimated)}
          hint={c?.approved != null ? t("tickets.costs.approvedHint", { amount: formatMoney(c.approved) }) : undefined}
        />
        <BigNumber label={t("costs.labor")} value={formatMoney(c?.labor ?? null, formatMoney(0))} />
        <BigNumber
          label={t("costs.parts")}
          value={formatMoney(c?.parts ?? null, formatMoney(0))}
          hint={stockValue ? t("tickets.costs.fromStorage", { amount: formatMoney(stockValue) }) : undefined}
        />
        <BigNumber
          label={t("costs.totalActual")}
          value={formatMoney(c?.totalActual ?? null, formatMoney(0))}
          hint={otherSpend ? t("tickets.costs.includesOther", { amount: formatMoney(otherSpend) }) : undefined}
          strong
        />
      </div>

      <Block title={t("tickets.costs.approval")} icon={Stamp}>
        {pendingLevel ? (
          <p className="mb-2 rounded-md border bg-orange-500/5 px-3 py-2 text-sm">
            {t("tickets.costs.waitingFor", { label: pendingLevel.label, amount: formatMoney(pendingLevel.amount) })}
          </p>
        ) : null}
        {latest ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", DECISION_TONE[latest.decision] ?? "bg-muted")}>
                {vocabText(t, vocabEntry(APPROVAL_DECISIONS, latest.decision))}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(latest.amount)}</span>
              <span className="text-muted-foreground">{t("tickets.costs.level", { label: latest.levelLabel })}</span>
            </div>
            <p className="text-muted-foreground">
              {t("tickets.costs.approvedBy", { name: latest.approverName })} · <LocalTimestamp iso={latest.decidedAt} showZone={false} />
            </p>
            {latest.note ? <p className="whitespace-pre-wrap">{latest.note}</p> : null}
            <AttachmentGallery attachments={latest.attachments} />
            {approvals.length > 1 ? <p className="text-xs text-muted-foreground">{t("tickets.costs.earlierApprovals", { count: approvals.length - 1 })}</p> : null}
          </div>
        ) : null}
        {!latest && !pendingLevel ? <Empty text={t("tickets.costs.noApproval")} /> : null}
      </Block>

      <Block title={t("tickets.costs.invoices")} icon={FileText}>
        {invoices.length === 0 ? <Empty text={t("tickets.costs.noInvoices")} /> : null}
        {invoices.length ? (
          <div className="flex flex-wrap gap-2">
            {invoiceFiles.map(({ file, payment: p }) => (
              <a
                key={`file-${file.id}`}
                href={file.url}
                download={file.originalName}
                target="_blank"
                rel="noopener noreferrer"
                title={t("tickets.costs.downloadInvoice", { name: file.originalName })}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted"
              >
                <Download className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{file.originalName}</span>
                <span className="shrink-0 text-muted-foreground">
                  · {p.invoiceNumber ? `${t("tickets.costs.invoiceNumber", { number: p.invoiceNumber })} · ` : ""}
                  {p.paidTo.name}
                </span>
              </a>
            ))}
            {numberOnly.map((p) => (
              <Link
                key={`payment-${p.paymentId}`}
                href={paymentHref(p.paymentId)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted"
              >
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {p.invoiceNumber ? t("tickets.costs.invoiceNumber", { number: p.invoiceNumber }) : t("tickets.costs.invoiceFile")}
                <span className="text-muted-foreground">· {p.paidTo.name}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </Block>

      <Block title={t("tickets.costs.payments")} icon={Wallet}>
        {issue.payments.length === 0 ? <Empty text={t("tickets.costs.noPayments")} /> : null}
        {issue.payments.length ? (
          <ul className="divide-y rounded-md border">
            {issue.payments.map((p) => (
              <li key={`${p.paymentId}-${p.lineId}`}>
                <Link href={paymentHref(p.paymentId)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/50">
                  <span className="tabular-nums text-muted-foreground">{formatDay(p.paidAt)}</span>
                  <span className="font-medium">{p.paidTo.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, p.type))}</span>
                  {p.hasInvoice ? <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("tickets.costs.hasInvoice")} /> : null}
                  <span className="ms-auto font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Block>

      <Block title={t("costs.unpaidPurchases")} icon={ShoppingBag}>
        {unpaid.length === 0 ? <Empty text={t("tickets.costs.noUnpaid")} /> : null}
        {unpaid.length ? (
          <ul className="divide-y rounded-md border">
            {unpaid.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="font-medium">{p.description}</span>
                <span className="text-xs text-muted-foreground">{t("tickets.costs.boughtBy", { name: p.technician.name })}</span>
                {p.supplier ? <span className="text-xs text-muted-foreground">{t("tickets.costs.at", { name: p.supplier.name })}</span> : null}
                <span className="ms-auto font-semibold tabular-nums">{formatMoney(p.totalCost)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Block>
    </div>
  );
}
