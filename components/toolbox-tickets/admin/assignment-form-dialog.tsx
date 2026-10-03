"use client";

import { useEffect, useState } from "react";
import { FolderTree, Layers, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect, type SearchableSelectOption } from "@/components/shared/searchable-select";
import { DialogShell, Field, FormError } from "@/components/workbooks/dialog-shell";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { TicketUserPicker, type PickedUser } from "../user-picker";
import type { CreateAssignmentPayload } from "@/types/toolbox-tickets.types";

type Target = "section" | "level";

interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionOptions: SearchableSelectOption<string>[];
  levelOptions: SearchableSelectOption<string>[];
  onSubmit: (payload: CreateAssignmentPayload) => Promise<unknown>;
}

/**
 * "This person owns this section (or level)". Exactly one target. The target
 * can't be moved later (that would silently re-route everything the person
 * owns) — delete and recreate. store_scoped defaults ON: fail closed.
 */
export function AssignmentFormDialog({
  open,
  onOpenChange,
  sectionOptions,
  levelOptions,
  onSubmit,
}: AssignmentFormDialogProps) {
  const t = useTranslations("toolboxTickets.admin.assignmentForm");
  const tc = useTranslations("toolboxTickets.common");
  const [user, setUser] = useState<PickedUser | null>(null);
  const [target, setTarget] = useState<Target>("section");
  const [targetId, setTargetId] = useState("");
  const [storeScoped, setStoreScoped] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUser(null);
    setTarget("section");
    setTargetId("");
    setStoreScoped(true);
    setErrors({});
    setFormError(null);
  }, [open]);

  const submit = async () => {
    if (saving) return;
    const e: Record<string, string> = {};
    if (!user) e.user_id = t("errors.user");
    if (!targetId) e.target = t("errors.target");
    setErrors(e);
    if (Object.keys(e).length || !user) return;

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit({
        userId: user.id,
        storeScoped,
        ...(target === "section" ? { sectionId: Number(targetId) } : { levelId: Number(targetId) }),
      });
      onOpenChange(false);
    } catch (err) {
      const parsed = parseTicketError(err, "admin");
      const fe = formErrors(parsed);
      if (parsed.code === "TICKET_ASSIGNMENT_DUPLICATE") fe.target = t("errors.duplicate");
      setErrors(fe);
      if (!fe.user_id && !fe.target && !fe.store_scoped) setFormError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
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
              {t("submit")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />
          <Field label={t("user")} required error={errors.user_id}>
            <TicketUserPicker value={user} onChange={setUser} disabled={saving} />
          </Field>

          <Field label={t("target")} required error={errors.target} hint={target === "level" ? t("levelHint") : t("sectionHint")}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(["section", "level"] as const).map((k) => {
                  const Icon = k === "section" ? Layers : FolderTree;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={target === k}
                      disabled={saving}
                      onClick={() => {
                        setTarget(k);
                        setTargetId("");
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                        target === k ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {k === "section" ? t("aSection") : t("aLevel")}
                    </button>
                  );
                })}
              </div>
              <SearchableSelect<string>
                options={target === "section" ? sectionOptions : levelOptions}
                value={targetId}
                onChange={setTargetId}
                placeholder={target === "section" ? t("pickSection") : t("pickLevel")}
                searchPlaceholder={tc("search")}
                emptyText={tc("noMatches")}
                disabled={saving}
              />
            </div>
          </Field>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch id="tbx-assign-scoped" checked={storeScoped} onCheckedChange={setStoreScoped} disabled={saving} />
            <label htmlFor="tbx-assign-scoped" className="min-w-0 flex-1 cursor-pointer">
              <span className="block text-sm font-medium">{t("scoped")}</span>
              <span className="block text-xs text-muted-foreground">
                {storeScoped ? t("scopedOn") : t("scopedOff")}
              </span>
            </label>
          </div>
        </div>
      </DialogShell>
    </Dialog>
  );
}
