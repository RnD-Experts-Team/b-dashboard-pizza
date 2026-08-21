"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  useGoalsList,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGoalMetricsList,
  useCreateGoalMetric,
  useDeleteGoalMetric,
} from "@/lib/hooks/use-goals";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import {
  Loader2,
  Plus,
  RefreshCw,
  Target,
  Pencil,
  Trash2,
  AlertCircle,
  ListChecks,
} from "lucide-react";
import type {
  Goal,
  GoalMetric,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateGoalMetricPayload,
} from "@/types/goal.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeletons                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function formatGoalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : format(d, "MMM d, yyyy");
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error banner helper                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
      </AlertDescription>
    </Alert>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create Goal Dialog                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateGoalPayload) => Promise<void>;
  isCreating: boolean;
  metrics: GoalMetric[];
  metricsLoading: boolean;
}

function CreateGoalDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
  metrics,
  metricsLoading,
}: CreateGoalDialogProps) {
  const [goalValue, setGoalValue] = useState("");
  const [selectedMetricId, setSelectedMetricId] = useState<string>("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setGoalValue("");
      setSelectedMetricId("");
      setWeekStart("");
      setWeekEnd("");
      setErrors({});
    }
  }, [open]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (goalValue === "" || isNaN(Number(goalValue))) {
      newErrors.goal = "Goal value is required and must be a number.";
    } else if (Number(goalValue) < 0) {
      newErrors.goal = "Goal value must be at least 0.";
    }
    if (!selectedMetricId) newErrors.metricId = "Please select a goal metric.";
    if (!weekStart) newErrors.weekStart = "Week start date is required.";
    if (!weekEnd) newErrors.weekEnd = "Week end date is required.";
    if (weekStart && weekEnd && weekEnd < weekStart) {
      newErrors.weekEnd = "Week end date must be on or after the start date.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onCreate({
      goal: Number(goalValue),
      goal_metric_id: parseInt(selectedMetricId, 10),
      week_start_date: weekStart,
      week_end_date: weekEnd,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Goal</DialogTitle>
          <DialogDescription>Add a new weekly goal for this store.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Metric select */}
          <div className="space-y-1.5">
            <Label htmlFor="create-goal-metric">Metric</Label>
            {metricsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : metrics.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No metrics available. Create one in the Goal Metrics section.
              </p>
            ) : (
              <Select value={selectedMetricId} onValueChange={setSelectedMetricId} disabled={isCreating}>
                <SelectTrigger id="create-goal-metric">
                  <SelectValue placeholder="Select a metric…" />
                </SelectTrigger>
                <SelectContent>
                  {metrics.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.metricId && <p className="text-xs text-destructive">{errors.metricId}</p>}
          </div>

          {/* Goal value */}
          <div className="space-y-1.5">
            <Label htmlFor="create-goal-value">Goal Value</Label>
            <Input
              id="create-goal-value"
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 100"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              disabled={isCreating}
            />
            {errors.goal && <p className="text-xs text-destructive">{errors.goal}</p>}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-week-start">Week Start</Label>
              <Input
                id="create-week-start"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                disabled={isCreating}
              />
              {errors.weekStart && <p className="text-xs text-destructive">{errors.weekStart}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-week-end">Week End</Label>
              <Input
                id="create-week-end"
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                disabled={isCreating}
              />
              {errors.weekEnd && <p className="text-xs text-destructive">{errors.weekEnd}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || metrics.length === 0}>
              {isCreating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Edit Goal Dialog                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

interface EditGoalDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (goalId: number, payload: UpdateGoalPayload) => Promise<void>;
  isUpdating: boolean;
}

function EditGoalDialog({ goal, open, onOpenChange, onUpdate, isUpdating }: EditGoalDialogProps) {
  const [goalValue, setGoalValue] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    if (open && goal) {
      setGoalValue(String(goal.goal));
      setGoalError(null);
    } else if (!open) {
      setGoalValue("");
      setGoalError(null);
    }
  }, [open, goal]);

  function validate(): boolean {
    if (goalValue === "" || isNaN(Number(goalValue))) {
      setGoalError("Goal value is required and must be a number.");
      return false;
    }
    if (Number(goalValue) < 0) {
      setGoalError("Goal value must be at least 0.");
      return false;
    }
    setGoalError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !goal) return;
    await onUpdate(goal.id, { goal: Number(goalValue) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
          <DialogDescription>
            Update the goal value for <span className="font-medium">{goal?.metric.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-value">Goal Value</Label>
            <Input
              id="edit-goal-value"
              type="number"
              min={0}
              step="any"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              disabled={isUpdating}
            />
            {goalError && <p className="text-xs text-destructive">{goalError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create Goal Metric Dialog                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface CreateGoalMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateGoalMetricPayload) => Promise<void>;
  isCreating: boolean;
}

function CreateGoalMetricDialog({ open, onOpenChange, onCreate, isCreating }: CreateGoalMetricDialogProps) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setName(""); setNameError(null); }
  }, [open]);

  function validate(): boolean {
    if (!name.trim()) { setNameError("Name is required."); return false; }
    if (name.trim().length > 255) { setNameError("Name must not exceed 255 characters."); return false; }
    setNameError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onCreate({ name: name.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Goal Metric</DialogTitle>
          <DialogDescription>Define a new metric that can be assigned to store goals.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-metric-name">Name</Label>
            <Input
              id="create-metric-name"
              placeholder="e.g. Daily Revenue"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Page                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export default function GoalsPage() {
  const { selectedStore } = useSelectedStoreStore();
  const storeId = selectedStore?.storeId ?? selectedStore?.id;
  const { canAccessRoute } = useAuthStore();
  const canViewGoalMetrics = canAccessRoute({ service: "Data", method: "GET", path: "/goal-metrics" });

  /* Goals */
  const { data, isLoading, isRefreshing, error: listError, refetch, clearError: clearListError } = useGoalsList(storeId);
  const { createGoal, isCreating, error: createError, clearError: clearCreateError } = useCreateGoal();
  const { updateGoal, isUpdating, error: updateError, clearError: clearUpdateError } = useUpdateGoal();
  const { deleteGoal, isDeleting, error: deleteError, clearError: clearDeleteError } = useDeleteGoal();

  /* Goal Metrics */
  const {
    metrics,
    isLoading: metricsLoading,
    isRefreshing: metricsRefreshing,
    error: metricsError,
    refetch: refetchMetrics,
    clearError: clearMetricsError,
  } = useGoalMetricsList();
  const { createGoalMetric, isCreating: isCreatingMetric, error: createMetricError, clearError: clearCreateMetricError } = useCreateGoalMetric();
  const { deleteGoalMetric, isDeleting: isDeletingMetric, error: deleteMetricError, clearError: clearDeleteMetricError } = useDeleteGoalMetric();

  /* Dialog state */
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [isCreateMetricOpen, setIsCreateMetricOpen] = useState(false);
  const [deletingMetric, setDeletingMetric] = useState<GoalMetric | null>(null);

  const goals = data?.data ?? [];

  /* ---- Goal Handlers ---- */

  async function handleCreateGoal(payload: CreateGoalPayload) {
    if (!storeId) return;
    try {
      await createGoal(storeId, payload);
      setIsCreateGoalOpen(false);
      refetch();
      toast.success("Goal created successfully.");
    } catch { /* error shown via banner */ }
  }

  async function handleUpdateGoal(goalId: number, payload: UpdateGoalPayload) {
    if (!storeId) return;
    try {
      await updateGoal(storeId, goalId, payload);
      setEditingGoal(null);
      refetch();
      toast.success("Goal updated successfully.");
    } catch { /* error shown via banner */ }
  }

  async function handleDeleteGoal() {
    if (!storeId || !deletingGoal) return;
    try {
      await deleteGoal(storeId, deletingGoal.id);
      setDeletingGoal(null);
      refetch();
      toast.success("Goal deleted successfully.");
    } catch { /* error shown via banner */ }
  }

  /* ---- Metric Handlers ---- */

  async function handleCreateMetric(payload: CreateGoalMetricPayload) {
    try {
      await createGoalMetric(payload);
      setIsCreateMetricOpen(false);
      refetchMetrics();
      toast.success("Goal metric created successfully.");
    } catch { /* error shown via banner */ }
  }

  async function handleDeleteMetric() {
    if (!deletingMetric) return;
    try {
      await deleteGoalMetric(deletingMetric.id);
      setDeletingMetric(null);
      refetchMetrics();
      toast.success("Goal metric deleted successfully.");
    } catch { /* error shown via banner */ }
  }

  /* ---- Guard ---- */

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Goals" description="Manage weekly goals and goal metrics." />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No store selected. Please select a store from the sidebar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" description="Manage weekly goals and goal metrics for this store.">
        <Button variant="outline" size="sm" onClick={refetch} disabled={isRefreshing || isLoading}>
          <RefreshCw className={`me-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setIsCreateGoalOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Add Goal
        </Button>
      </PageHeader>

      {/* Error banners */}
      {listError && <ErrorBanner message={listError} onDismiss={clearListError} />}
      {createError && <ErrorBanner message={createError} onDismiss={clearCreateError} />}
      {updateError && <ErrorBanner message={updateError} onDismiss={clearUpdateError} />}
      {deleteError && <ErrorBanner message={deleteError} onDismiss={clearDeleteError} />}
      {metricsError && <ErrorBanner message={metricsError} onDismiss={clearMetricsError} />}
      {createMetricError && <ErrorBanner message={createMetricError} onDismiss={clearCreateMetricError} />}
      {deleteMetricError && <ErrorBanner message={deleteMetricError} onDismiss={clearDeleteMetricError} />}

      {/* ── Goals Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Weekly Goals
            {!isLoading && (
              <Badge variant="secondary" className="ms-1">
                {data?.meta.total ?? goals.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton cols={4} />
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No goals found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add your first goal using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Goal Value</TableHead>
                    <TableHead>Week Start</TableHead>
                    <TableHead>Week End</TableHead>
                    <TableHead className="text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{goal.id}</TableCell>
                      <TableCell className="font-medium">{goal.metric.name}</TableCell>
                      <TableCell>{goal.goal}</TableCell>
                      <TableCell>{formatGoalDate(goal.weekStartDate)}</TableCell>
                      <TableCell>{formatGoalDate(goal.weekEndDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingGoal(goal)} disabled={isDeleting}>
                            <Pencil className="h-4 w-4" /><span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setDeletingGoal(goal)}
                            disabled={isDeleting}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canViewGoalMetrics && <Separator />}

      {/* ── Goal Metrics Table ───────────────────────────────────────────── */}
      {canViewGoalMetrics && <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              Goal Metrics
              {!metricsLoading && (
                <Badge variant="secondary" className="ms-1">{metrics.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refetchMetrics}
                disabled={metricsRefreshing || metricsLoading}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`me-2 h-4 w-4 ${metricsRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setIsCreateMetricOpen(true)} className="flex-1 sm:flex-none">
                <Plus className="me-2 h-4 w-4" />
                Add Metric
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {metricsLoading ? (
            <TableSkeleton cols={2} />
          ) : metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ListChecks className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No goal metrics defined</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create a metric first, then assign it to a goal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{metric.id}</TableCell>
                      <TableCell className="font-medium">{metric.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setDeletingMetric(metric)}
                            disabled={isDeletingMetric}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      <CreateGoalDialog
        open={isCreateGoalOpen}
        onOpenChange={setIsCreateGoalOpen}
        onCreate={handleCreateGoal}
        isCreating={isCreating}
        metrics={metrics}
        metricsLoading={metricsLoading}
      />

      <EditGoalDialog
        goal={editingGoal}
        open={editingGoal !== null}
        onOpenChange={(open) => { if (!open) setEditingGoal(null); }}
        onUpdate={handleUpdateGoal}
        isUpdating={isUpdating}
      />

      <CreateGoalMetricDialog
        open={isCreateMetricOpen}
        onOpenChange={setIsCreateMetricOpen}
        onCreate={handleCreateMetric}
        isCreating={isCreatingMetric}
      />

      {/* Delete Goal confirm */}
      <AlertDialog open={deletingGoal !== null} onOpenChange={(open) => { if (!open) setDeletingGoal(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the goal for{" "}
              <span className="font-semibold">{deletingGoal?.metric.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Metric confirm */}
      <AlertDialog open={deletingMetric !== null} onOpenChange={(open) => { if (!open) setDeletingMetric(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal Metric</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the metric{" "}
              <span className="font-semibold">{deletingMetric?.name}</span>? Goals using this metric may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMetric}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMetric}
              disabled={isDeletingMetric}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingMetric && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
