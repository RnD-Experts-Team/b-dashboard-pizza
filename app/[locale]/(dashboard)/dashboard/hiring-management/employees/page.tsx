"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateEmployeeDialog } from "@/components/hiring/create-employee-dialog";

export default function EmployeesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Manage employees for your stores."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Add Employee
        </Button>
      </PageHeader>

      {/* Placeholder for future employee listing */}
      <div className="rounded-lg border p-10 text-center text-muted-foreground text-sm">
        Click &quot;Add Employee&quot; to create a new employee record.
      </div>

      <CreateEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
