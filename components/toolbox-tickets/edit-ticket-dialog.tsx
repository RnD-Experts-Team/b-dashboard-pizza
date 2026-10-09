"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { DialogShell, Field, FormError } from "@/components/workbooks/dialog-shell";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { useToolboxTicketsCatalog } from "@/lib/store/toolbox-tickets-catalog.store";
import type { TicketSection, ToolboxTicket, UpdateTicketPayload } from "@/types/toolbox-tickets.types";

const TITLE_MAX = 190;
const DESCRIPTION_MAX = 20_000;

interface EditTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: ToolboxTicket;
  /**
   * Re-routing needs assignee rights even though editing the wording doesn't.
   * Shown when the viewer can both edit and change status (assignee-only);
   * the server's 403 is still handled if that ever disagrees.
   */
  canResection: boolean;
  sections: TicketSection[] | null;
  onSubmit: (payload: UpdateTicketPayload) => Promise<unknown>;
  onError: (err: unknown) => void;
}

export function EditTicketDialog({
  open,
  onOpenChange,
  ticket,
  canResection,
  sections,
  onSubmit,
  onError,
}: EditTicketDialogProps) {
  const t = useTranslations("toolboxTickets.edit");
  const tc = useTranslations("toolboxTickets.common");
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [sectionKey, setSectionKey] = useState(ticket.section?.key ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(ticket.title);
    setDescription(ticket.description);
    setSectionKey(ticket.section?.key ?? "");
    setErrors({});
    setFormError(null);
    // Only on open — a background poll must not wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sectionOptions = useMemo<SearchableSelectOption<string>[]>(() => {
    const list = (sections ?? []).map((s) => ({ value: s.key, label: s.name, hint: s.key }));
    // Keep the current section listed even if it has since been retired.
    if (ticket.section && !list.some((o) => o.value === ticket.section!.key)) {
      list.unshift({ value: ticket.section.key, label: ticket.section.name, hint: ticket.section.key });
    }
    return list;
  }, [sections, ticket.section]);

  const submit = async () => {
    if (saving) return;
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t("errors.title");
    if (!description.trim()) e.description = t("errors.description");
    setErrors(e);
    if (Object.keys(e).length) return;

    // Changed keys only: a reporter sending an unchanged section_key would 403.
    const payload: UpdateTicketPayload = {};
    if (title.trim() !== ticket.title) payload.title = title.trim();
    if (description.trim() !== ticket.description) payload.description = description.trim();
    if (canResection && sectionKey && sectionKey !== ticket.section?.key) payload.sectionKey = sectionKey;
    if (!Object.keys(payload).length) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(payload);
      toast.success(payload.sectionKey ? t("rerouted") : t("saved"));
      onOpenChange(false);
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      setErrors(fe);
      if (parsed.code === "TICKET_SECTION_INACTIVE") void useToolboxTicketsCatalog.getState().reload();
      if (!fe.title && !fe.description && !fe.section_key) {
        setFormError(parsed.message);
        onError(parsed);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        size="lg"
        busy={saving}
        title={t("title")}
        description={ticket.status === "pending" ? t("descriptionPending") : t("description")}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <Field label={t("ticketTitle")} htmlFor="tbx-edit-title" required error={errors.title} hint={`${title.length} / ${TITLE_MAX}`}>
            <Input
              id="tbx-edit-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
            />
          </Field>
          <Field
            label={t("ticketDescription")}
            htmlFor="tbx-edit-description"
            required
            error={errors.description}
            hint={`${description.length.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()}`}
          >
            <Textarea
              id="tbx-edit-description"
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              className="min-h-40 resize-y"
            />
          </Field>
          {canResection && (
            <Field label={t("section")} error={errors.section_key} hint={t("sectionHint")}>
              <SearchableSelect<string>
                options={sectionOptions}
                value={sectionKey}
                onChange={setSectionKey}
                searchPlaceholder={tc("search")}
                emptyText={tc("noMatches")}
                disabled={saving}
                icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </Field>
          )}
        </div>
      </DialogShell>
    </Dialog>
  );
}
