"use client";

import { useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { maintenanceWorkflowService } from "@/lib/api/services/maintenance-workflow.service";
import { ANSWERED_VIA, PRIORITIES, vocabOptions, vocabText } from "@/lib/maintenance/vocabulary";
import type { AnsweredVia, InfoRequest, Priority, TicketIssueDetail } from "@/types/maintenance-system";
import { DateTimePicker, Segmented } from "../../form-bits";
import { PasteFileZone } from "../../paste-file-zone";
import { ActionDialog, Field, MoreDetails, useDialogSubmit } from "../dialog-kit";
import { isoToLocalInput, localInputToIso } from "../format";
import type { RunStep, StepDialogProps } from "./types";

const STORE_PRIORITY = "store";

/** The open question the store has not answered yet (latest first). */
export function openInfoRequest(issue: TicketIssueDetail): InfoRequest | null {
  return [...issue.infoRequests].reverse().find((r) => !r.mistaken && !r.answeredAt) ?? null;
}

/* ── Review (and the inline "Ticket details" edit) ───────────────────────── */

export function ReviewDialog({ open, onOpenChange, issue, run }: StepDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  const initial = {
    target: isoToLocalInput(issue.targetCompletionAt),
    nextAction: issue.nextAction ?? "",
    priority: issue.assignedPriority?.value ?? STORE_PRIORITY,
  };
  const [target, setTarget] = useState(initial.target);
  const [nextAction, setNextAction] = useState(initial.nextAction);
  const [priority, setPriority] = useState<string>(initial.priority);
  const dirty = target !== initial.target || nextAction !== initial.nextAction || priority !== initial.priority;
  const starting = issue.status.value === "new";

  async function onSubmit() {
    const ok = await form.submit(() =>
      run((key) =>
        maintenanceWorkflowService.review(key, {
          targetCompletionAt: localInputToIso(target),
          nextAction: nextAction.trim() || null,
          assignedPriority: priority === STORE_PRIORITY ? null : (priority as Priority),
        }),
      ),
    );
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={dirty}
      title={starting ? t("workflow.actions.review") : t("tickets.dialogs.review.updateTitle")}
      description={starting ? t("tickets.dialogs.review.startHelp") : t("tickets.dialogs.review.updateHelp")}
      submitLabel={starting ? t("workflow.actions.review") : t("common.save")}
      onSubmit={() => void onSubmit()}
    >
      <Field label={t("tickets.overview.targetCompletion")} help={t("tickets.dialogs.review.targetHelp")} error={form.fieldError("target_completion_at")}>
        <DateTimePicker value={target} onChange={setTarget} placeholder={t("tickets.dialogs.review.pickTarget")} />
      </Field>
      <Field id="review-next" label={t("tickets.nextAction")} error={form.fieldError("next_action")}>
        <Input
          id="review-next"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder={t("tickets.dialogs.review.nextActionPlaceholder")}
          aria-invalid={Boolean(form.fieldError("next_action")) || undefined}
        />
      </Field>
      <Field label={t("tickets.dialogs.review.priority")} help={t("tickets.dialogs.review.priorityHelp", { priority: issue.priority.label })} error={form.fieldError("assigned_priority")}>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label={t("tickets.dialogs.review.priority")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STORE_PRIORITY}>{t("tickets.dialogs.review.keepStorePriority")}</SelectItem>
            {vocabOptions(PRIORITIES).map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {vocabText(t, p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </ActionDialog>
  );
}

/* ── Ask the store ───────────────────────────────────────────────────────── */

export function AskStoreDialog({ open, onOpenChange, run }: StepDialogProps) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  async function onSubmit() {
    if (!question.trim()) return form.setFieldErrors({ question: t("tickets.dialogs.askStore.questionRequired") });
    const ok = await form.submit(
      () => run((key) => maintenanceWorkflowService.askStore(key, { question: question.trim(), files })),
      t("tickets.dialogs.askStore.sent"),
    );
    if (ok) {
      setQuestion("");
      setFiles([]);
      onOpenChange(false);
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(question.trim() || files.length)}
      title={t("workflow.actions.info_request")}
      description={t("tickets.dialogs.askStore.help")}
      submitLabel={t("tickets.dialogs.askStore.submit")}
      onSubmit={() => void onSubmit()}
    >
      <Field id="ask-question" label={t("tickets.dialogs.askStore.question")} required error={form.fieldError("question")}>
        <Textarea
          id="ask-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-h-24"
          placeholder={t("tickets.dialogs.askStore.questionPlaceholder")}
          aria-invalid={Boolean(form.fieldError("question")) || undefined}
        />
      </Field>
      <Field label={t("common.photos")} help={t("tickets.dialogs.askStore.photosHelp")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
    </ActionDialog>
  );
}

/* ── The store's answer ──────────────────────────────────────────────────── */

function useAnswer(issue: TicketIssueDetail, run: RunStep, isMos: boolean) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  const request = openInfoRequest(issue);
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [via, setVia] = useState<AnsweredVia>(isMos ? "specialist" : "store");

  async function send(): Promise<boolean> {
    if (!request) return false;
    if (!answer.trim()) {
      form.setFieldErrors({ answer: t("tickets.dialogs.answer.answerRequired") });
      return false;
    }
    const ok = await form.submit(
      () => run((key) => maintenanceWorkflowService.answerStoreQuestion(key, request.id, { answer: answer.trim(), files, via })),
      t("tickets.dialogs.answer.sent"),
    );
    if (ok) {
      setAnswer("");
      setFiles([]);
    }
    return ok;
  }

  return { t, form, request, answer, setAnswer, files, setFiles, via, setVia, send };
}

type AnswerState = ReturnType<typeof useAnswer>;

function AnswerFields({ state, isMos, idPrefix }: { state: AnswerState; isMos: boolean; idPrefix: string }) {
  const { t, form, request, answer, setAnswer, files, setFiles, via, setVia } = state;
  return (
    <>
      {request ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            {request.askedBy?.name ? t("tickets.dialogs.answer.askedBy", { name: request.askedBy.name }) : t("tickets.dialogs.answer.question")}
          </p>
          <p className="whitespace-pre-wrap text-sm">{request.question}</p>
        </div>
      ) : null}
      <Field id={`${idPrefix}-answer`} label={t("tickets.dialogs.answer.answer")} required error={form.fieldError("answer")}>
        <Textarea
          id={`${idPrefix}-answer`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="min-h-24"
          placeholder={t("tickets.dialogs.answer.answerPlaceholder")}
          aria-invalid={Boolean(form.fieldError("answer")) || undefined}
        />
      </Field>
      <Field label={t("common.photos")} error={form.fieldError("files")}>
        <PasteFileZone files={files} onChange={setFiles} />
      </Field>
      {isMos ? (
        <Field label={t("tickets.dialogs.answer.who")} help={t("tickets.dialogs.answer.whoHelp")}>
          <Segmented
            value={via}
            onChange={setVia}
            options={vocabOptions(ANSWERED_VIA).map((o) => ({ value: o.value, label: vocabText(t, o) }))}
          />
        </Field>
      ) : null}
    </>
  );
}

export function AnswerDialog({ open, onOpenChange, issue, run, isMos }: StepDialogProps) {
  const state = useAnswer(issue, run, isMos);
  const { t, form, answer, files } = state;
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={Boolean(answer.trim() || files.length)}
      title={t("workflow.actions.answer")}
      description={state.request ? undefined : t("tickets.dialogs.answer.noQuestion")}
      submitLabel={t("tickets.dialogs.answer.submit")}
      canSubmit={Boolean(state.request)}
      onSubmit={() => void (async () => (await state.send()) && onOpenChange(false))()}
    >
      <AnswerFields state={state} isMos={isMos} idPrefix="dialog" />
    </ActionDialog>
  );
}

/** The store manager's answer box on the Overview's current step card. */
export function InlineAnswer({ issue, run, isMos }: { issue: TicketIssueDetail; run: RunStep; isMos: boolean }) {
  const state = useAnswer(issue, run, isMos);
  const { t, form } = state;
  if (!state.request) return null;
  return (
    <div data-action-scope={form.scope}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.busy) void state.send();
        }}
      >
        <AnswerFields state={state} isMos={isMos} idPrefix="inline" />
        {form.formError ? (
          <p className="text-sm text-destructive" role="alert">
            {form.formError}
          </p>
        ) : null}
        <Button type="submit" disabled={form.busy}>
          {form.busy ? t("common.saving") : t("tickets.dialogs.answer.submit")}
        </Button>
      </form>
    </div>
  );
}

/* ── Is it working now? ──────────────────────────────────────────────────── */

function useConfirmation(run: RunStep, isMos: boolean) {
  const t = useTranslations("maintenanceSystem");
  const form = useDialogSubmit();
  const [working, setWorking] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [via, setVia] = useState<AnsweredVia>(isMos ? "specialist" : "store");

  async function send(answer: boolean): Promise<boolean> {
    return form.submit(
      () => run((key) => maintenanceWorkflowService.confirm(key, { working: answer, note: note.trim() || null, via })),
      answer ? t("tickets.dialogs.confirmation.thanksWorking") : t("tickets.dialogs.confirmation.thanksBroken"),
    );
  }

  return { t, form, working, setWorking, note, setNote, via, setVia, send };
}

function YesNo({ value, onChange, disabled }: { value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTranslations("maintenanceSystem.tickets.dialogs.confirmation");
  const options = [
    { v: true, label: t("yes"), Icon: CircleCheck, on: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    { v: false, label: t("no"), Icon: CircleX, on: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("question")}>
      {options.map(({ v, label, Icon, on }) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            value === v ? on : "bg-background hover:bg-muted/60",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmationDialog({ open, onOpenChange, run, isMos }: StepDialogProps) {
  const state = useConfirmation(run, isMos);
  const { t, form, working, setWorking, note, setNote, via, setVia } = state;
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      dirty={working !== null || Boolean(note.trim())}
      title={t("workflow.actions.confirmation")}
      description={t("tickets.dialogs.confirmation.help")}
      submitLabel={t("common.save")}
      canSubmit={working !== null}
      onSubmit={() => void (async () => working !== null && (await state.send(working)) && onOpenChange(false))()}
    >
      <YesNo value={working} onChange={setWorking} />
      {working === false ? <p className="text-xs text-muted-foreground">{t("tickets.dialogs.confirmation.noHelp")}</p> : null}
      <MoreDetails defaultOpen={working === false}>
        <Field id="confirm-note" label={t("common.note")} error={form.fieldError("note")}>
          <Textarea id="confirm-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
      </MoreDetails>
      {isMos ? (
        <Field label={t("tickets.dialogs.answer.who")} help={t("tickets.dialogs.answer.whoHelp")}>
          <Segmented value={via} onChange={setVia} options={vocabOptions(ANSWERED_VIA).map((o) => ({ value: o.value, label: vocabText(t, o) }))} />
        </Field>
      ) : null}
    </ActionDialog>
  );
}

/** Yes / No straight on the Overview's current step card (the store's view). */
export function InlineConfirmation({ run, isMos }: { run: RunStep; isMos: boolean }) {
  const state = useConfirmation(run, isMos);
  const { t, form, working, setWorking } = state;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("tickets.dialogs.confirmation.question")}</p>
      <YesNo
        value={working}
        disabled={form.busy}
        onChange={(v) => {
          setWorking(v);
          void state.send(v);
        }}
      />
      {form.formError ? (
        <p className="text-sm text-destructive" role="alert">
          {form.formError}
        </p>
      ) : null}
    </div>
  );
}
