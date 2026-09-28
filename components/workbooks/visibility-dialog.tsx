"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useWorkbookOptions } from "@/lib/hooks/use-workbook-options";
import { getWorkbookFieldErrors, hasServerCode, isCancelled } from "@/lib/workbooks/errors";
import type { Breadcrumb, Tagged, VisibilityPayload } from "@/types/workbooks.types";
import { DialogShell, FormError } from "./dialog-shell";
import { useErrorText } from "./guarded";
import {
  VisibilityFields,
  toVisibilityPayload,
  visibilityDraftError,
  type ParentAccess,
  type VisibilityDraft,
} from "./visibility-fields";

interface VisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What's being retagged, for the title. */
  itemName: string;
  current: Tagged;
  parent?: ParentAccess | null;
  /** Sends the retag. Resolve on success, throw a WorkbooksError on failure. */
  onSubmit: (payload: VisibilityPayload) => Promise<void>;
  /** Crumbs above the item, so a refusal can name the capping folder. */
  breadcrumb?: Breadcrumb[];
}

/** Retag a folder, workbook or row — the same dialog for all three. */
export function VisibilityDialog({
  open,
  onOpenChange,
  itemName,
  current,
  parent,
  onSubmit,
  breadcrumb,
}: VisibilityDialogProps) {
  const t = useTranslations("workbooks");
  const errorText = useErrorText();
  const { visibilities, loading } = useWorkbookOptions();
  const [draft, setDraft] = useState<VisibilityDraft>({ visibility: current.visibility, roles: current.visibilityRoles ?? [] });
  const [saving, setSaving] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({ visibility: current.visibility, roles: current.visibilityRoles ?? [] });
      setRolesError(null);
      setFormError(null);
    }
  }, [open, current.visibility, current.visibilityRoles]);

  const submit = async () => {
    const localError = visibilityDraftError(draft, visibilities);
    if (localError) {
      setRolesError(t("visibility.rolesRequired"));
      return;
    }
    setSaving(true);
    setRolesError(null);
    setFormError(null);
    try {
      await onSubmit(toVisibilityPayload(draft, visibilities));
      toast.success(t("visibility.saved"));
      onOpenChange(false);
    } catch (err) {
      if (isCancelled(err)) return;
      const fields = getWorkbookFieldErrors(err);
      if (hasServerCode(err, "WORKBOOK_ROLES_REQUIRED") || fields.visibility_roles) {
        setRolesError(fields.visibility_roles ?? t("visibility.rolesRequired"));
      } else {
        const message = errorText(err, breadcrumb);
        setFormError(message);
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogShell
        busy={saving}
        title={t("visibility.editTitle")}
        description={t("visibility.editDescription", { name: itemName })}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving || loading}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormError message={formError} />
          <VisibilityFields
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setRolesError(null);
            }}
            options={visibilities}
            loading={loading}
            parent={parent}
            rolesError={rolesError}
            disabled={saving}
            idPrefix="retag"
          />
        </div>
      </DialogShell>
    </Dialog>
  );
}
