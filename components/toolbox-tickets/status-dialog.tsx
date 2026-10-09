"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DialogShell, Field, FormError } from "@/components/workbooks/dialog-shell";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { TicketStatusBadge } from "./ticket-status-badge";
import type { TicketStatus } from "@/types/toolbox-tickets.types";

const REASON_MAX = 1000;

const STALE_CODES: ReadonlySet<string> = new Set([
  "TICKET_ALREADY_IN_STATUS",
  "TICKET_ILLEGAL_TRANSITION",
  "TICKET_NOT_REOPENABLE",
  "TICKET_FORBIDDEN",
  "NOT_FOUND",
]);

export type StatusIntent = { kind: "status"; to: TicketStatus } | { kind: "reopen" };

interface StatusDialogProps {
  intent: StatusIntent | null;
  from: TicketStatus;
  onOpenChange: (open: boolean) => void;
  onSubmit: (intent: StatusIntent, reason: string) => Promise<unknown>;
  /** Called with non-field failures so the page can toast them. */
  onError: (err: unknown) => void;
}

/**
 * Confirms a status move. A reopen (terminal → pending, via `/reopen`)
 * REQUIRES a reason; any other move takes an optional one that's recorded in
 * the history. Submit is disabled while in flight — a double click would 409.
 */
export function StatusDialog({ intent, from, onOpenChange, onSubmit, onError }: StatusDialogProps) {
  const t = useTranslations("toolboxTickets.statusDialog");
  const tc = useTranslations("toolboxTickets.common");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (intent) {
      setReason("");
      setError(null);
      setFormError(null);
    }
  }, [intent]);

  const reopen = intent?.kind === "reopen";
  const to: TicketStatus = intent?.kind === "status" ? intent.to : "pending";

  const submit = async () => {
    if (!intent || saving) return;
    if (reopen && !reason.trim()) {
      setError(t("reasonRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(intent, reason.trim());
      onOpenChange(false);
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      if (fe.reason) {
        setError(fe.reason);
      } else if (STALE_CODES.has(parsed.code)) {
        // The server refused because our buttons were stale (already moved,
        // illegal from here, no longer allowed). The page has re-fetched —
        // close so the fresh buttons are what the user sees.
        onError(parsed);
        onOpenChange(false);
      } else {
        // Timeout / network / server: keep the dialog and the typed reason.
        setFormError(parsed.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={intent !== null} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        busy={saving}
        title={reopen ? t("reopenTitle") : t("title")}
        description={reopen ? t("reopenDescription") : t("description")}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {reopen ? t("reopenSubmit") : t("submit")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <TicketStatusBadge status={from} />
            <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
            <TicketStatusBadge status={to} />
          </div>
          {reopen && <p className="text-xs text-muted-foreground">{t("reopenNote")}</p>}
          <Field
            label={reopen ? t("reasonLabelRequired") : t("reasonLabel")}
            htmlFor="tbx-status-reason"
            required={reopen}
            error={error}
            hint={`${reason.length} / ${REASON_MAX}`}
          >
            <Textarea
              id="tbx-status-reason"
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              placeholder={reopen ? t("reopenPlaceholder") : t("reasonPlaceholder")}
              disabled={saving}
              className="min-h-28 resize-y"
            />
          </Field>
        </div>
      </DialogShell>
    </Dialog>
  );
}
