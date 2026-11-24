"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreHorizontal, Eye, Pencil, Trash2, Shield } from "lucide-react";
import { useRoles, useDeleteRole } from "@/lib/hooks/use-roles";
import type { RoleWithStats } from "@/types/role.types";

export default function RolesPage() {
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || "en";
  
  const { roles, pagination, filters, isLoading, handleSearch, handlePageChange, refetch } =
    useRoles();
  const { deleteRole, isDeleting } = useDeleteRole();

  const [roleToDelete, setRoleToDelete] = useState<RoleWithStats | null>(null);

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRole(roleToDelete.id);
      setRoleToDelete(null);
      // Stay on the current page (and search); step back one page when the
      // deleted role was the only row left on it.
      const current = pagination?.page ?? 1;
      const page = roles.length <= 1 && current > 1 ? current - 1 : current;
      refetch({ page, search: filters.search || undefined });
    } catch (error) {
      console.error("Failed to delete role:", error);
    }
  };

  const columns = [
    {
      key: "name",
      header: t("columns.name"),
      cell: (role: RoleWithStats) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{role.name}</span>
        </div>
      ),
    },
    {
      key: "guardName",
      header: t("columns.guardName"),
      cell: (role: RoleWithStats) => (
        <Badge variant="outline">{role.guardName}</Badge>
      ),
    },
    {
      key: "users",
      header: t("columns.users"),
      cell: (role: RoleWithStats) => (
        <span className="text-muted-foreground">{role.usersCount}</span>
      ),
    },
    {
      key: "permissions",
      header: t("columns.permissions"),
      cell: (role: RoleWithStats) => (
        <span className="text-muted-foreground">{role.permissionsCount}</span>
      ),
    },
    {
      key: "createdAt",
      header: t("columns.createdAt"),
      cell: (role: RoleWithStats) => (
        <span className="text-muted-foreground">
          {new Date(role.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (role: RoleWithStats) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/roles/${role.id}`)
              }
            >
              <Eye className="me-2 h-4 w-4" />
              {t("actions.view")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/roles/${role.id}/edit`)
              }
            >
              <Pencil className="me-2 h-4 w-4" />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setRoleToDelete(role)}
            >
              <Trash2 className="me-2 h-4 w-4" />
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-[50px]",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={() => router.push(`/${locale}/dashboard/roles/create`)}>
          <Plus className="me-2 h-4 w-4" />
          {t("addRole")}
        </Button>
      </PageHeader>

      <DataTable
        data={roles}
        columns={columns}
        isLoading={isLoading}
        searchable
        searchPlaceholder={t("searchPlaceholder")}
        onSearchChange={handleSearch}
        emptyMessage={t("noRoles")}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.description", { name: roleToDelete?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? tCommon("deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
