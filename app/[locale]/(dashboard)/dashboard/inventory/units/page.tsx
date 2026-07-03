"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useUnits } from "@/lib/hooks/use-inventory-units";
import { isDisplayableErrorMessage } from "@/lib/api/inventory-errors";
import { UnitFormDialog } from "@/components/inventory/unit-form-dialog";
import { DeleteConfirmDialog } from "@/components/inventory/delete-confirm-dialog";
import type { Unit } from "@/types/inventory.types";

/**
 * Units list page — create/edit via a dialog, delete with confirmation.
 * A 422 on delete (unit still referenced by an item) is shown as a toast.
 */
export default function UnitsPage() {
  const { units, pagination, isLoading, isDeleting, error, deleteError, deleteUnit, handlePageChange } =
    useUnits();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);

  // Surface list-load errors as a toast (but never for canceled requests).
  useEffect(() => {
    if (isDisplayableErrorMessage(error)) toast.error(error);
  }, [error]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUnit(deleting.id);
      toast.success("Unit deleted.");
      setDeleting(null);
    } catch {
      // deleteError shown as a toast below; keep the dialog open.
      if (isDisplayableErrorMessage(deleteError)) toast.error(deleteError);
    }
  };

  const columns = [
    { key: "name", header: "Name", cell: (u: Unit) => u.name },
    {
      key: "items_count",
      header: "Items",
      cell: (u: Unit) => <Badge variant="secondary">{u.items_count ?? 0}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (u: Unit) => (
        <div data-no-row-click="true" className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(u)}>
                <Pencil className="me-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleting(u)}
              >
                <Trash2 className="me-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Units" description="Measurement units used by inventory items.">
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          New unit
        </Button>
      </PageHeader>

      <DataTable
        data={units}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No units yet. Create your first one."
        pagination={pagination}
        onPageChange={handlePageChange}
        getRowKey={(u) => u.id}
      />

      <UnitFormDialog open={formOpen} onOpenChange={setFormOpen} unit={editing} />

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete unit"
        description={`Delete "${deleting?.name}"? This cannot be undone, and fails if the unit is still used by an item.`}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
