"use client";

import { Image as ImageIcon, MessageCircleQuestion, Pencil, Phone, ShieldCheck, User, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RESOLUTIONS, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { isOverdue } from "@/lib/maintenance-workflow";
import type { TicketIssueV2 } from "@/types/maintenance-v2";
import { AttachmentGallery } from "../attachment-gallery";
import { LocalTimestamp } from "../local-timestamp";
import { TroubleshootingSteps } from "../troubleshooting/troubleshooting-steps";
import { ChecklistView } from "./dialogs/finish-dialogs";
import { InlineAnswer, InlineConfirmation, openInfoRequest } from "./dialogs/review-store-dialogs";
import type { RunStep } from "./dialogs/types";
import { formatDay } from "./format";

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
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

export function OverviewTab({
  issue,
  run,
  isMos,
  canAnswer,
  canConfirm,
  canEditDetails,
  onEditDetails,
}: {
  issue: TicketIssueV2;
  run: RunStep;
  isMos: boolean;
  canAnswer: boolean;
  canConfirm: boolean;
  /** The MOS may update target / next action now (review is a valid step). */
  canEditDetails: boolean;
  onEditDetails: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const status = issue.status.value;
  const request = openInfoRequest(issue);
  const overdue = isOverdue(issue.targetCompletionAt, status);
  const checklist = issue.workflow?.checklist ?? [];
  const snapshot = issue.troubleshootingSnapshot;
  const showChecklist = status === "work_done" || status === "closed";

  return (
    <div className="space-y-4">
      {/* Ticket details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
          <CardTitle className="font-heading text-base font-semibold">{t("tickets.overview.detailsTitle")}</CardTitle>
          {canEditDetails ? (
            <Button variant="ghost" size="sm" className="h-8" onClick={onEditDetails}>
              <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("common.edit")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
            <Cell label={t("tickets.assignedTo")}>
              {issue.technicians.length ? (
                <ul className="space-y-0.5">
                  {issue.technicians.map((tech) => (
                    <li key={tech.id} className="truncate">
                      <span className="font-medium">{tech.name}</span>
                      {tech.phone ? (
                        <a href={`tel:${tech.phone}`} className="ms-2 text-xs text-muted-foreground hover:underline">
                          {tech.phone}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">{t("tickets.overview.nobodyYet")}</span>
              )}
            </Cell>
            <Cell label={t("tickets.overview.targetCompletion")}>
              {issue.targetCompletionAt ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <LocalTimestamp iso={issue.targetCompletionAt} showZone={false} />
                  {overdue ? (
                    <span className="rounded-full bg-orange-500/15 px-1.5 py-px text-[10px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                      {t("tickets.attention.overdue")}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("tickets.overview.notSet")}</span>
              )}
            </Cell>
            <Cell label={t("tickets.nextAction")}>
              {issue.nextAction ? <span>{issue.nextAction}</span> : <span className="text-muted-foreground">{t("tickets.overview.notSet")}</span>}
            </Cell>
          </div>
        </CardContent>
      </Card>

      {/* The current step */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("tickets.overview.currentStep")}</p>
          <CardTitle className="font-heading text-base font-semibold">{t(`tickets.overview.step.${status}.title`)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`tickets.overview.step.${status}.${isMos ? "office" : "store"}`)}</p>

          {status === "waiting_on_store" && request ? (
            <div className="space-y-3">
              <div className="flex gap-2 rounded-md border bg-amber-500/5 px-3 py-2">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t("tickets.overview.openQuestion")}
                    {request.askedBy?.name ? ` · ${request.askedBy.name}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{request.question}</p>
                  <AttachmentGallery attachments={request.attachments ?? []} />
                </div>
              </div>
              {!isMos && canAnswer ? <InlineAnswer issue={issue} run={run} isMos={false} /> : null}
            </div>
          ) : null}

          {status === "work_done" && !isMos && canConfirm ? <InlineConfirmation run={run} isMos={false} /> : null}

          {status === "work_done" && issue.storeConfirmedAt ? (
            <p className="text-sm">
              {issue.storeConfirmedWorking ? t("tickets.overview.confirmedWorking") : t("tickets.overview.confirmedBroken")}
            </p>
          ) : null}

          {issue.workPerformed && (status === "work_done" || status === "closed") ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t("tickets.overview.workPerformed")}</p>
              <p className="whitespace-pre-wrap text-sm">{issue.workPerformed}</p>
            </div>
          ) : null}

          {status === "closed" && issue.resolution ? (
            <p className="text-sm">
              {t("tickets.overview.closedAs", { resolution: vocabText(t, vocabEntry(RESOLUTIONS, issue.resolution.value, issue.resolution.label)) })}
            </p>
          ) : null}

          {showChecklist && checklist.length ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">{t("tickets.overview.closeChecklist")}</p>
              <ChecklistView items={checklist} resolution={null} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Description and contact */}
      <Section title={t("common.description")} icon={User}>
        <div className="space-y-3">
          {issue.description ? (
            <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tickets.overview.noDescription")}</p>
          )}
          {issue.contactName || issue.contactPhone ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">{t("tickets.overview.contact")}</span>
              {issue.contactName ? <span className="font-medium">{issue.contactName}</span> : null}
              {issue.contactPhone ? (
                <a href={`tel:${issue.contactPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {issue.contactPhone}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </Section>

      {/* Troubleshooting the store did */}
      <Section title={t("tickets.overview.troubleshooting")} icon={Wrench}>
        {snapshot ? (
          <div className="space-y-2">
            <p className="text-sm">
              {snapshot.outcome === "none_match"
                ? t("tickets.overview.troubleshootingNoneMatch")
                : t("tickets.overview.troubleshootingTried", { guide: snapshot.guideTitle ?? "—" })}
            </p>
            {snapshot.steps.length ? (
              <TroubleshootingSteps steps={snapshot.steps} linkUrl={snapshot.linkUrl} fileNames={snapshot.files.map((f) => f.name)} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tickets.overview.troubleshootingNone")}</p>
        )}
      </Section>

      {/* Photos */}
      <Section title={t("common.photos")} icon={ImageIcon}>
        {issue.attachments.length ? (
          <AttachmentGallery attachments={issue.attachments} className="mt-0" />
        ) : (
          <p className="text-sm text-muted-foreground">{t("tickets.overview.noPhotos")}</p>
        )}
      </Section>

      {/* Warranties */}
      {issue.warranties.some((w) => !w.mistaken) ? (
        <Section title={t("tickets.overview.warranties")} icon={ShieldCheck}>
          <ul className="space-y-2">
            {issue.warranties
              .filter((w) => !w.mistaken)
              .map((w) => (
                <li key={w.id} className="text-sm">
                  {w.body ? <p className="whitespace-pre-wrap">{w.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{t("tickets.overview.warrantyUntil", { date: formatDay(w.expiryDate) })}</p>
                </li>
              ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
