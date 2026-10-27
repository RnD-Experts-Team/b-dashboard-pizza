"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/inventory/delete-confirm-dialog";
import { MinAgeBadge } from "@/components/skills/skill-badges";
import { SkillFormDialog } from "@/components/skills/skill-form-dialog";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSkillsCatalog } from "@/lib/hooks/use-skills-catalog";
import type { SchedulingError } from "@/lib/scheduling/errors";
import type { Skill, SkillDraft } from "@/types/skills.types";

const SKELETON_ROWS = 6;

/**
 * The shared skills list. Everyone who reaches the page sees it; adding,
 * editing and deleting show only for the head (`manage skills` globally).
 */
export function SkillsCatalog() {
  const t = useTranslations("skills");
  const { canAccessRoute } = useAuthStore();
  const { skills, isLoading, error, refetch, createSkill, updateSkill, deleteSkill } = useSkillsCatalog();

  const canCreate = canAccessRoute({ service: "Operations", method: "POST", path: "/v1/skills" });
  const canEdit = canAccessRoute({ service: "Operations", method: "POST", path: "/v1/skills/*" });
  const canDelete = canAccessRoute({ service: "Operations", method: "DELETE", path: "/v1/skills/*" });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openForm = (skill: Skill | null) => {
    setEditing(skill);
    setFormOpen(true);
  };

  const submit = async (draft: SkillDraft) => {
    if (editing) {
      await updateSkill(editing.id, draft);
      toast.success(t("skillSaved"));
    } else {
      await createSkill(draft);
      toast.success(t("skillAdded"));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteSkill(deleting.id);
      toast.success(t("skillDeleted"));
      setDeleting(null);
    } catch (err) {
      toast.error((err as SchedulingError).message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && skills.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("loadFailed")}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {error.message}
          <Button size="sm" variant="outline" onClick={refetch}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="me-1.5 h-4 w-4" />
            {t("newSkill")}
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("restriction")}</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => (
              <TableRow key={skill.id}>
                <TableCell className="font-medium">{skill.name}</TableCell>
                <TableCell>
                  {skill.min_age !== null ? (
                    <div className="space-y-1">
                      <MinAgeBadge minAge={skill.min_age} />
                      {skill.restriction_note && (
                        <p className="text-xs text-muted-foreground">{skill.restriction_note}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {(canEdit || canDelete) && (
                  <TableCell className="text-end">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => openForm(skill)} aria-label={t("editSkill")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(skill)}
                        aria-label={t("deleteSkill")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SkillFormDialog open={formOpen} onOpenChange={setFormOpen} skill={editing} onSubmit={submit} />

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle", { skill: deleting?.name ?? "" })}
        description={t("deleteDescription")}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
