"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
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

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  hourly: "Hourly",
};

interface Props {
  tasks: CleaningTask[];
  onUpdateTask: (taskId: number, payload: UpdateTaskPayload) => Promise<unknown>;
  onDeleteTask: (taskId: number) => Promise<void>;
}

export function TasksList({ tasks, onUpdateTask, onDeleteTask }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CleaningTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteTask(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      if (activeId === deleteTarget.id) setActiveId(null);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : "Could not delete task.");
    } finally {
      setDeleting(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
        No cleaning tasks yet. Create one to get started.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead className="hidden sm:table-cell">Frequency</TableHead>
              <TableHead className="hidden lg:table-cell">Weight</TableHead>
              <TableHead className="hidden md:table-cell">Photo</TableHead>
              <TableHead className="hidden md:table-cell">Starts</TableHead>
              <TableHead className="hidden lg:table-cell">Stores</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setActiveId(t.id)}>
                <TableCell className="font-medium">
                  {t.name}
                  {t.description && (
                    <p className="max-w-xs truncate text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                    {(FREQ_LABEL[t.frequency] ?? t.frequency)} · {t.stores.length} store
                    {t.stores.length === 1 ? "" : "s"}
                  </p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {FREQ_LABEL[t.frequency] ?? t.frequency}
                  {t.frequency === "hourly" && t.intervalHours
                    ? ` · every ${t.intervalHours}h`
                    : ""}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{t.weight ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={t.photoRequired ? "secondary" : "outline"}>
                    {t.photoRequired ? "Required" : "Optional"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">
                  {formatDate(t.startsAt)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{t.stores.length}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit task"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTaskId(t.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete task"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(t);
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
                const t = tasks.find((x) => x.id === activeId);
                if (t) setDeleteTarget(t);
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
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.name}” from Due lists for every assigned
              store. Its history and completions are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
