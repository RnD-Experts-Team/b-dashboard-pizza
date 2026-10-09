"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2, Plus, Store, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { DialogShell, Field, FormError } from "@/components/workbooks/dialog-shell";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { useToolboxTicketsCatalog } from "@/lib/store/toolbox-tickets-catalog.store";
import { TicketFilePicker, fileErrorsFrom, hasBadFiles, withoutFileErrors } from "./file-picker";
import { TicketUserPicker, type PickedUser } from "./user-picker";
import { useRoleOptions } from "./participant-role";
import {
  type ParticipantRole,
  type TicketSection,
  type ToolboxTicket,
} from "@/types/toolbox-tickets.types";

const TITLE_MAX = 190;
const DESCRIPTION_MAX = 20_000;
const MAX_PARTICIPANTS = 20;

interface DraftParticipant {
  user: PickedUser | null;
  role: ParticipantRole;
}

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: TicketSection[] | null;
  sectionsLoading: boolean;
  storeOptions: SearchableSelectOption<string>[];
  defaultStore: string | null;
  currentUserId: number | null;
  onCreated: (ticket: ToolboxTicket) => void;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  sections,
  sectionsLoading,
  storeOptions,
  defaultStore,
  currentUserId,
  onCreated,
}: CreateTicketDialogProps) {
  const t = useTranslations("toolboxTickets.create");
  const tc = useTranslations("toolboxTickets.common");
  const roleOptions = useRoleOptions();

  const [storeCode, setStoreCode] = useState<string>("");
  const [sectionKey, setSectionKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh form every time it opens.
  useEffect(() => {
    if (!open) return;
    setStoreCode(defaultStore ?? "");
    setSectionKey("");
    setTitle("");
    setDescription("");
    setParticipants([]);
    setFiles([]);
    setErrors({});
    setFormError(null);
  }, [open, defaultStore]);

  const sectionOptions = useMemo<SearchableSelectOption<string>[]>(
    () => (sections ?? []).map((s) => ({ value: s.key, label: s.name, hint: s.key })),
    [sections],
  );
  const selectedSection = sections?.find((s) => s.key === sectionKey);

  const pickedIds = participants.map((p) => p.user?.id).filter((id): id is number => id != null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!storeCode) e.store = t("errors.store");
    if (!sectionKey) e.section_key = t("errors.section");
    if (!title.trim()) e.title = t("errors.title");
    if (!description.trim()) e.description = t("errors.description");
    if (participants.some((p) => !p.user)) e.participants = t("errors.participant");
    if (hasBadFiles(files)) e.files = t("errors.files");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await toolboxTicketsService.createTicket(storeCode, {
        sectionKey,
        title: title.trim(),
        description: description.trim(),
        participants: participants
          .filter((p): p is { user: PickedUser; role: ParticipantRole } => p.user !== null)
          .map((p) => ({ userId: p.user.id, role: p.role })),
        files,
      });
      // Not a failure, never retried: the report is saved, nobody owns the area yet.
      if (result.warnings.includes("no_recipients")) {
        toast.warning(t("noRecipients"), { description: t("noRecipientsBody"), duration: 8000 });
      } else {
        toast.success(t("created"));
      }
      onOpenChange(false);
      onCreated(result.ticket);
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      // Participant errors arrive as participants.N.user_id — show them on the block.
      const participantError = Object.entries(fe).find(([k]) => k.startsWith("participants"))?.[1];
      if (participantError) fe.participants = participantError;
      if (parsed.code === "STORE_NOT_FOUND") fe.store = parsed.message;
      // The area was retired since the picker loaded — refresh the list so it drops out.
      if (parsed.code === "TICKET_SECTION_INACTIVE") void useToolboxTicketsCatalog.getState().reload();
      setErrors(fe);
      const known = ["store", "section_key", "title", "description", "participants"].some((k) => fe[k]);
      const fileKnown = Object.keys(fileErrorsFrom(fe)).length > 0;
      if (!known && !fileKnown) {
        setFormError(parsed.message);
        toast.error(parsed.message);
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
        description={t("description")}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {saving ? t("submitting") : t("submit")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("store")} required error={errors.store}>
              <SearchableSelect<string>
                options={storeOptions}
                value={storeCode}
                onChange={setStoreCode}
                placeholder={t("storePlaceholder")}
                searchPlaceholder={tc("search")}
                emptyText={tc("noMatches")}
                disabled={saving}
                icon={<Store className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </Field>
            <Field
              label={t("section")}
              required
              error={errors.section_key}
              hint={selectedSection?.description ?? t("sectionHint")}
            >
              <SearchableSelect<string>
                options={sectionOptions}
                value={sectionKey}
                onChange={setSectionKey}
                placeholder={t("sectionPlaceholder")}
                searchPlaceholder={tc("search")}
                emptyText={sections && sections.length === 0 ? t("noSections") : tc("noMatches")}
                loading={sectionsLoading}
                disabled={saving}
                icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </Field>
          </div>

          <Field
            label={t("ticketTitle")}
            htmlFor="tbx-ticket-title"
            required
            error={errors.title}
            hint={`${title.length} / ${TITLE_MAX}`}
          >
            <Input
              id="tbx-ticket-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              disabled={saving}
            />
          </Field>

          <Field
            label={t("ticketDescription")}
            htmlFor="tbx-ticket-description"
            required
            error={errors.description}
            hint={`${description.length.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()}`}
          >
            <Textarea
              id="tbx-ticket-description"
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              disabled={saving}
              className="min-h-32 resize-y"
            />
          </Field>

          <Field label={t("participants")} error={errors.participants} hint={t("participantsHint")}>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                  <TicketUserPicker
                    value={p.user}
                    onChange={(user) =>
                      setParticipants((list) => list.map((x, j) => (j === i ? { ...x, user } : x)))
                    }
                    excludeIds={[
                      ...(currentUserId !== null ? [currentUserId] : []),
                      ...pickedIds.filter((id) => id !== p.user?.id),
                    ]}
                    disabled={saving}
                    className="col-span-1"
                  />
                  <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                    <SearchableSelect<ParticipantRole>
                      options={roleOptions}
                      value={p.role}
                      onChange={(role) =>
                        setParticipants((list) => list.map((x, j) => (j === i ? { ...x, role } : x)))
                      }
                      searchPlaceholder={tc("search")}
                      disabled={saving}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={saving}
                    aria-label={tc("remove")}
                    onClick={() => setParticipants((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {participants.length < MAX_PARTICIPANTS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => setParticipants((list) => [...list, { user: null, role: "responder" }])}
                >
                  <Plus className="me-1 h-3.5 w-3.5" />
                  {t("addParticipant")}
                </Button>
              )}
            </div>
          </Field>

          <Field label={t("files")} error={errors.files}>
            <TicketFilePicker
              files={files}
              onChange={(next) => {
                setFiles(next);
                setErrors(withoutFileErrors);
              }}
              disabled={saving}
              serverErrors={fileErrorsFrom(errors)}
            />
          </Field>
        </div>
      </DialogShell>
    </Dialog>
  );
}
