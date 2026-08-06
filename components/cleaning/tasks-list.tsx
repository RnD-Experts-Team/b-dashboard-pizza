"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, ClipboardList, Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CleaningError } from "@/lib/api/services/cleaning.service";
import type { CleaningTask, UpdateTaskPayload } from "@/types/cleaning.types";
import { formatDate } from "./cleaning-ui";
import { TaskDetailSheet } from "./task-detail-sheet";
import { EditTaskDialog } from "./edit-task-dialog";

interface Props {
  tasks: CleaningTask[];
  onUpdateTask: (taskId: number, payload: UpdateTaskPayload) => Promise<unknown>;
  onDeleteTask: (taskId: number) => Promise<void>;
}

export function TasksList({ tasks, onUpdateTask, onDeleteTask }: Props) {
  const t = useTranslations("cleaningChart");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CleaningTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteTask(deleteTarget.id);
      toast.success(t("tasks.toasts.deleted", { name: deleteTarget.name }));
      setDeleteTarget(null);
      if (activeId === deleteTarget.id) setActiveId(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("tasks.toasts.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("tasks.empty.title")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("tasks.empty.description")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tasks.table.task")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("tasks.table.frequency")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("tasks.table.weight")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("tasks.table.photo")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("tasks.table.starts")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("tasks.table.stores")}</TableHead>
              <TableHead className="text-end">{t("tasks.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className="cursor-pointer"
                onClick={() => setActiveId(task.id)}
              >
                <TableCell className="font-medium">
                  {task.name}
                  {task.description && (
                    <p className="max-w-xs truncate text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                    {t(`frequency.${task.frequency}`)} ·{" "}
                    {task.stores.length === 1
                      ? t("tasks.storeCount", { count: task.stores.length })
                      : t("tasks.storeCountPlural", { count: task.stores.length })}
                  </p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {t(`frequency.${task.frequency}`)}
                  {task.frequency === "hourly" && task.intervalHours
                    ? ` ${t("tasks.everyHoursSuffix", { hours: task.intervalHours })}`
                    : ""}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{task.weight ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={task.photoRequired ? "secondary" : "outline"}>
                    {task.photoRequired
                      ? t("tasks.photoRequiredShort")
                      : t("tasks.photoOptionalShort")}
                  </Badge>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">
                  {formatDate(task.startsAt)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{task.stores.length}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t("tasks.editTitle")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTaskId(task.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title={t("tasks.deleteTitle")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(task);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TaskDetailSheet
        taskId={activeId}
        open={activeId != null}
        onOpenChange={(o) => !o && setActiveId(null)}
        onEdit={
          activeId != null
            ? () => {
                setEditTaskId(activeId);
                setActiveId(null);
              }
            : undefined
        }
        onDelete={
          activeId != null
            ? () => {
                const task = tasks.find((x) => x.id === activeId);
                if (task) setDeleteTarget(task);
              }
            : undefined
        }
      />

      <EditTaskDialog
        taskId={editTaskId}
        open={editTaskId != null}
        onOpenChange={(o) => !o && setEditTaskId(null)}
        onUpdate={onUpdateTask}
      />

      {/* Confirm delete (soft delete: removed from Due, history/completions kept) */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.deleteDialog.description", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
