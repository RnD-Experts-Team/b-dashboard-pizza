"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Plus, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { userService } from "@/lib/api/services/user.service";
import type { User } from "@/types/user.types";

export default function UsersPage() {
  const t = useTranslations("users");
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || "en";
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);

  const perPage = useMemo(() => {
    const rawPerPage = searchParams.get("per_page");
    const parsedPerPage = Number.parseInt(rawPerPage ?? "", 10);

    if (!Number.isFinite(parsedPerPage) || parsedPerPage <= 0) {
      return 20;
    }

    return parsedPerPage;
  }, [searchParams]);

  const fetchUsers = useCallback(
    async (options?: { page?: number; search?: string }) => {
      const page = options?.page ?? 1;
      const search = options?.search ?? "";

      setIsLoading(true);
      try {
        const response = await userService.getUsers({
          page,
          perPage,
          search,
        });

        setUsers(response.data);
        setPagination(response.meta);

        if (response.meta.page !== page) {
          setCurrentPage(response.meta.page);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [perPage]
  );

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await userService.deleteUser(userToDelete.id);
      setUserToDelete(null);
      await fetchUsers({ page: currentPage, search: searchQuery });
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: "user",
      header: t("columns.user"),
      cell: (user: User) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-xs">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: t("columns.role"),
      cell: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role.id} variant="outline" className="capitalize">
                {role.name}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="capitalize">
              No roles
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (user: User) => (
        <Badge
          variant={
            user.status === "active"
              ? "default"
              : user.status === "inactive"
              ? "secondary"
              : "outline"
          }
          className="capitalize"
        >
          {user.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: t("columns.joined"),
      cell: (user: User) => (
        <span className="text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (user: User) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/users/${user.id}`)
              }
            >
              <Eye className="me-2 h-4 w-4" />
              {t("actions.view")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/users/${user.id}/edit`)
              }
            >
              <Pencil className="me-2 h-4 w-4" />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setUserToDelete(user)}
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

  useEffect(() => {
    void fetchUsers({ page: currentPage, search: searchQuery });
  }, [currentPage, fetchUsers, searchQuery]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      setSearchQuery(searchValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button onClick={() => router.push(`/${locale}/dashboard/users/create`)}>
          <Plus className="me-2 h-4 w-4" />
          {t("addUser")}
        </Button>
      </PageHeader>

      <DataTable
        data={users}
        columns={columns}
        isLoading={isLoading}
        searchable
        searchPlaceholder={t("searchPlaceholder")}
        onSearchChange={handleSearchChange}
        emptyMessage={t("noUsers")}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
