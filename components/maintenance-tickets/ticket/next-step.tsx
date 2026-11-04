"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CircleCheck, FileText, Hourglass, MessageCircleQuestion, MessageSquareReply, ScanSearch, Stamp, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/maintenance/money";
import { ISSUE_STATUSES, RESOLUTIONS, WHOSE_TURN, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { actionMeta, issuePhase, phaseStatus, splitNextActions, stepDots, whoseTurn, type IssuePhase, type StepDotState } from "@/lib/maintenance-workflow";
import type { TicketIssueDetail, WorkflowNextAction } from "@/types/maintenance-system";
import { AttachmentGallery } from "../attachment-gallery";
import { LocalTimestamp } from "../local-timestamp";
import { ChecklistView } from "./dialogs/finish-dialogs";
import { InlineAnswer, InlineConfirmation, openInfoRequest } from "./dialogs/review-store-dialogs";
import type { RunStep } from "./dialogs/types";
import { formatDayTime } from "./format";
import { useActionLabel } from "./ticket-footer";
import { visitedStatuses } from "./ticket-top";

/** The typed note the close step writes "what was wrong and how it was fixed" into. */
const FIX_NOTE_TYPE = "final_notes";
/** Checklist items a late invoice / payment fills in after closing. */
const PAYMENT_CHECKS = new Set(["cost_recorded", "invoice_attached"]);

/** The tabs the Now panel can point at. */
export type DetailTab = "work" | "costs";

/** Which tab holds the details of the step an issue is on. */
export const STEP_TAB: Partial<Record<IssuePhase, DetailTab>> = {
  inspection: "work",
  waiting_approval: "costs",
  scheduled: "work",
};

const DOT_CLASS: Record<StepDotState, string> = {
  done: "border-primary bg-primary",
  current: "border-primary bg-primary ring-4 ring-primary/25",
  skipped: "border-muted-foreground/50 bg-background",
  upcoming: "border-border bg-muted",
};
const LINE_DONE = "bg-primary";
const LINE_TODO = "bg-border";
/** How much of the panel's buttons must show before the bar's copy hides. */
const ON_SCREEN_SHARE = 0.6;

/** The line into a dot: none before the first, filled once that dot is reached. */
function lineClass(edge: boolean, reached: boolean): string {
  if (edge) return "bg-transparent";
  return reached ? LINE_DONE : LINE_TODO;
}

/**
 * A callback ref, and whether that element is on screen (the bottom bar
 * hides its copy of the buttons meanwhile). A callback ref, because the
 * buttons come and go as the step changes.
 */
export function useOnScreen(): [(node: HTMLDivElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    // The observer reports the starting state straight away, then every change.
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: ON_SCREEN_SHARE });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, Boolean(node) && onScreen];
}

/* ── The step strip ──────────────────────────────────────────────────────── */

function StepStrip({ issue }: { issue: TicketIssueDetail }) {
  const t = useTranslations("maintenanceSystem");
  const at = phaseStatus(issuePhase(issue));
  const dots = stepDots(at, [...visitedStatuses(issue), issue.status.value, at]);
  const cancelled = issue.status.value === "cancelled";
  return (
    <ol className="flex items-start" aria-label={t("tickets.page.progress")}>
      {dots.map((dot, index) => {
        const label = cancelled && dot.id === "closed" ? vocabText(t, ISSUE_STATUSES.cancelled) : t(dot.key);
        const reached = dot.state === "done" || dot.state === "current" || dot.state === "skipped";
        const nextReached = Boolean(dots[index + 1]) && dots[index + 1].state !== "upcoming";
        return (
          <li key={dot.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-current={dot.state === "current" ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", lineClass(index === 0, reached))} aria-hidden="true" />
              <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", DOT_CLASS[dot.state])} aria-hidden="true" />
              <span className={cn("h-0.5 flex-1", lineClass(index === dots.length - 1, nextReached))} aria-hidden="true" />
            </div>
            <span
              className={cn(
                "hidden w-full truncate px-0.5 text-center text-[11px] leading-tight sm:block",
                dot.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                dot.state === "skipped" && "line-through decoration-muted-foreground/50",
              )}
            >
              {label}
            </span>
            <span className="sr-only">{`${label}: ${t(`tickets.page.stepState.${dot.state}`)}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── What the current step is about (short facts, with a link to the tab) ── */

function Fact({ icon: Icon, children }: { icon: typeof ScanSearch; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

function StepFacts({ issue, isMos, canAnswer, canConfirm, run }: { issue: TicketIssueDetail; isMos: boolean; canAnswer: boolean; canConfirm: boolean; run: RunStep }) {
  const t = useTranslations("maintenanceSystem");
  const status = issue.status.value;
  const request = openInfoRequest(issue);
  const inspection = issue.inspections.filter((i) => !i.mistaken).sort((a, b) => b.id - a.id)[0] ?? null;
  const booking = issue.schedules.filter((s) => !s.mistaken && !s.endedAt && s.kind === "work").sort((a, b) => b.id - a.id)[0] ?? null;
  const answered = status === "in_review" ? [...issue.infoRequests].reverse().find((r) => !r.mistaken && r.answeredAt) ?? null : null;
  const level = status === "waiting_approval" ? issue.workflow?.approvalLevelFor ?? null : null;
  const checklist = issue.workflow?.checklist ?? [];

  const facts: React.ReactNode[] = [];

  if (status === "waiting_on_store" && request) {
    facts.push(
      <Fact key="question" icon={MessageCircleQuestion}>
        <p className="text-xs text-muted-foreground">
          {t("tickets.overview.openQuestion")}
          {request.askedBy?.name ? ` · ${request.askedBy.name}` : ""}
        </p>
        <p className="whitespace-pre-wrap">{request.question}</p>
        <AttachmentGallery attachments={request.attachments ?? []} />
      </Fact>,
    );
  }

  if (answered) {
    facts.push(
      <Fact key="answer" icon={MessageSquareReply}>
        <p className="text-xs text-muted-foreground">
          {answered.answeredByName ? t("tickets.overview.answeredByName", { name: answered.answeredByName }) : t("tickets.overview.answeredByStore")}
          {answered.answeredAt ? (
            <>
              {" · "}
              <LocalTimestamp iso={answered.answeredAt} showZone={false} />
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{answered.question}</p>
        <p className="whitespace-pre-wrap">{answered.answer}</p>
        <AttachmentGallery attachments={answered.attachments ?? []} />
      </Fact>,
    );
  }

  if ((status === "inspection" || status === "waiting_approval") && inspection) {
    facts.push(
      <Fact key="inspection" icon={ScanSearch}>
        <p>
          {t("tickets.now.inspectionBy", { name: inspection.technician?.name ?? "—", date: formatDayTime(inspection.scheduledDate, inspection.scheduledTime, inspection.scheduledTimeTo) })}
        </p>
        {inspection.status === "done" ? (
          <>
            {inspection.findings ? <p className="whitespace-pre-wrap text-muted-foreground">{inspection.findings}</p> : null}
            {inspection.estimatedCost != null ? (
              <p className="font-semibold tabular-nums">{t("tickets.work.quote", { amount: formatMoney(inspection.estimatedCost) })}</p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">{t("tickets.now.noResultYet")}</p>
        )}
      </Fact>,
    );
  }

  if (level) {
    facts.push(
      <Fact key="approval" icon={Stamp}>
        <p className="font-medium">{t("tickets.costs.waitingFor", { label: level.label, amount: formatMoney(level.amount) })}</p>
      </Fact>,
    );
  }

  const phase = issuePhase(issue);
  const approval = issue.approvals.filter((a) => !a.mistaken).sort((a, b) => b.id - a.id)[0] ?? null;
  if (phase === "approved" && approval) {
    facts.push(
      <Fact key="approved" icon={Stamp}>
        <p className="font-medium">{t("tickets.now.approvedBy", { name: approval.approverName, amount: formatMoney(approval.amount), label: approval.levelLabel })}</p>
        {approval.note ? <p className="whitespace-pre-wrap text-muted-foreground">{approval.note}</p> : null}
      </Fact>,
    );
  }
  if (phase === "not_fixed") {
    facts.push(
      <Fact key="not-fixed" icon={MessageSquareReply}>
        <p>
          {t("tickets.overview.confirmedBroken")}
          {issue.storeConfirmedByName ? ` (${issue.storeConfirmedByName})` : ""}
        </p>
      </Fact>,
    );
  }

  if (status === "scheduled") {
    facts.push(
      <Fact key="booking" icon={CalendarClock}>
        <p>
          {booking
            ? t("tickets.now.workBooked", { name: booking.technician?.name ?? "—", date: formatDayTime(booking.date, booking.time, booking.timeTo) })
            : t("tickets.now.workNotBooked")}
        </p>
      </Fact>,
    );
  }

  if ((status === "work_done" || status === "closed") && issue.workPerformed) {
    facts.push(
      <Fact key="work" icon={CircleCheck}>
        <p className="text-xs text-muted-foreground">{t("tickets.overview.workPerformed")}</p>
        <p className="whitespace-pre-wrap">{issue.workPerformed}</p>
      </Fact>,
    );
  }

  if (status === "work_done" && issue.storeConfirmedAt) {
    facts.push(
      <Fact key="confirmed" icon={MessageSquareReply}>
        <p>
          {issue.storeConfirmedWorking ? t("tickets.overview.confirmedWorking") : t("tickets.overview.confirmedBroken")}
          {issue.storeConfirmedByName ? ` (${issue.storeConfirmedByName})` : ""}
        </p>
      </Fact>,
    );
  }

  if (status === "closed" && issue.resolution) {
    facts.push(
      <Fact key="resolution" icon={CircleCheck}>
        <p>{t("tickets.overview.closedAs", { resolution: vocabText(t, vocabEntry(RESOLUTIONS, issue.resolution.value, issue.resolution.label)) })}</p>
      </Fact>,
    );
  }

  // What was wrong and how it was fixed, written when it was closed.
  const fixSummary = status === "closed" ? [...issue.notes].reverse().find((n) => n.type === FIX_NOTE_TYPE) ?? null : null;
  if (fixSummary) {
    facts.push(
      <Fact key="fix" icon={FileText}>
        <p className="text-xs text-muted-foreground">{t("tickets.dialogs.close.fixSummary")}</p>
        <p className="whitespace-pre-wrap">{fixSummary.body}</p>
      </Fact>,
    );
  }

  const showChecklist = (status === "work_done" || status === "closed") && checklist.length > 0;
  const inlineAnswer = status === "waiting_on_store" && request && !isMos && canAnswer;
  const inlineConfirm = status === "work_done" && !isMos && canConfirm && !issue.storeConfirmedAt;

  if (!facts.length && !showChecklist && !inlineAnswer && !inlineConfirm) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-background/60 p-3">
      {facts}
      {showChecklist ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("tickets.overview.closeChecklist")}</p>
          <ChecklistView items={checklist} resolution={null} />
        </div>
      ) : null}
      {inlineAnswer ? <InlineAnswer issue={issue} run={run} /> : null}
      {inlineConfirm ? <InlineConfirmation run={run} /> : null}
    </div>
  );
}

/* ── The panel ───────────────────────────────────────────────────────────── */

/**
 * "Where is this, and what do I do now?" — on top of every tab: the step
 * strip, whose move it is, one sentence, the facts of this step, and every
 * step that can run now as a visible button (the main one solid). The
 * bottom bar repeats the main button only once this panel is scrolled away.
 */
export function NextStepPanel({
  issue,
  next,
  isMos,
  canAnswer,
  canConfirm,
  run,
  disabled,
  actionsRef,
  onAction,
  onShowTab,
  onRecordPayment,
}: {
  issue: TicketIssueDetail;
  /** The steps this viewer may run now (already filtered by permission). */
  next: WorkflowNextAction[];
  isMos: boolean;
  canAnswer: boolean;
  canConfirm: boolean;
  run: RunStep;
  disabled?: boolean;
  actionsRef: (node: HTMLDivElement | null) => void;
  onAction: (action: WorkflowNextAction) => void;
  onShowTab: (tab: DetailTab) => void;
  /** Present when the viewer may record payments: shown on a finished issue still missing its cost or invoice. */
  onRecordPayment?: () => void;
}) {
  const t = useTranslations("maintenanceSystem");
  const label = useActionLabel();
  const status = issue.status.value;
  // Back in review after an approval / a failed fix reads as "ready to schedule", not step 2.
  const phase = issuePhase(issue);
  const dots = stepDots(phaseStatus(phase));
  const current = Math.max(0, dots.findIndex((d) => d.state === "current"));
  const stepName = status === "cancelled" ? vocabText(t, ISSUE_STATUSES.cancelled) : t(dots[current].key);

  // The store answers / confirms in the boxes above; no second button for the same thing.
  const inline = new Set<string>(isMos ? [] : ["answer", "confirmation"]);
  const shown = next.filter((a) => !inline.has(a.action));
  const { primary, others } = splitNextActions(shown);
  const yourMove = next.length > 0;
  const turn = whoseTurn(status);
  const finished = status === "closed" || status === "cancelled";
  const detailTab = STEP_TAB[phase];
  // Closed or cancelled, the invoice can still come in late.
  const paymentMissing = finished && (issue.workflow?.checklist ?? []).some((c) => PAYMENT_CHECKS.has(c.key) && !c.done);
  const latePayment = Boolean(onRecordPayment) && finished;

  return (
    <section aria-labelledby="ticket-now-title" className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-4 shadow-sm dark:bg-primary/[0.06] sm:p-5">
      <StepStrip issue={issue} />

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
            {t("tickets.now.stepOf", { step: current + 1, total: dots.length, label: stepName })}
          </p>
          {!finished && yourMove ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
              {t("tickets.now.yourMove")}
            </span>
          ) : null}
          {!finished && !yourMove && turn !== "none" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Hourglass className="h-3 w-3" aria-hidden="true" />
              {t("tickets.now.waitingOn", { who: vocabText(t, WHOSE_TURN[turn]) })}
            </span>
          ) : null}
        </div>
        <h2 id="ticket-now-title" className="font-heading text-lg font-semibold leading-snug">
          {t(`tickets.overview.step.${phase}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground">{t(`tickets.overview.step.${phase}.${isMos ? "office" : "store"}`)}</p>
      </div>

      <StepFacts issue={issue} isMos={isMos} canAnswer={canAnswer} canConfirm={canConfirm} run={run} />

      {latePayment && paymentMissing ? <p className="text-sm text-amber-700 dark:text-amber-300">{t("tickets.now.paymentMissing")}</p> : null}

      {primary || detailTab || latePayment ? (
        <div ref={actionsRef} className="flex flex-wrap items-center gap-2">
          {primary ? (
            <Button
              size="lg"
              onClick={() => onAction(primary)}
              disabled={disabled}
              variant={actionMeta(primary.action).destructive ? "destructive" : "default"}
              className="min-w-0 max-sm:w-full"
            >
              <span className="truncate">{label(primary, status)}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
          ) : null}
          {others.map((a) => (
            <Button
              key={a.action}
              variant="outline"
              onClick={() => onAction(a)}
              disabled={disabled}
              className={cn("min-w-0 max-sm:flex-1", actionMeta(a.action).destructive && "text-destructive hover:text-destructive")}
            >
              <span className="truncate">{label(a, status)}</span>
            </Button>
          ))}
          {latePayment ? (
            <Button variant={paymentMissing ? "default" : "outline"} onClick={onRecordPayment} disabled={disabled} className="min-w-0 max-sm:w-full">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{t("tickets.now.recordPayment")}</span>
            </Button>
          ) : null}
          {detailTab ? (
            <Button variant="link" className="h-auto px-1 text-sm" onClick={() => onShowTab(detailTab)}>
              {t("tickets.now.seeDetails", { tab: t(`workflow.tabs.${detailTab}`) })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
