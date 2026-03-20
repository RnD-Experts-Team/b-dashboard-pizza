"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, UserMinus } from "lucide-react";
import { userService } from "@/lib/api/services/user.service";
import type { User } from "@/types/user.types";

export default function UserStoreAssignmentPage() {
  const t = useTranslations("userStoreAssignment");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);

  const fetchUsers = useCallback(
    async (options?: { page?: number; search?: string }) => {
      const page = options?.page ?? 1;
      const search = options?.search ?? "";

      setIsLoading(true);
      try {
        const response = await userService.getUsers({
          page,
          pageSize: 15,
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
    []
  );

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
      key: "roles",
      header: t("columns.roles"),
      cell: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role.id} variant="outline" className="capitalize">
                {role.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "storesAssigned",
      header: t("columns.storesAssigned"),
      cell: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.stores && user.stores.length > 0 ? (
            user.stores.map((s) => (
              <Badge key={s.store.id} variant="secondary">
                {s.store.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={() =>
              router.push(
                `/${locale}/dashboard/user-store-assignment/remove`
              )
            }
          >
            <UserMinus className="bg me-2 h-4 w-4" />
            {t("removeUser")}
          </Button>

          <Button
            onClick={() =>
              router.push(
                `/${locale}/dashboard/user-store-assignment/assign`
              )
            }
          >
            <Plus className="me-2 h-4 w-4" />
            {t("assignStore")}
          </Button>
        </div>
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
    </div>
  );
}
