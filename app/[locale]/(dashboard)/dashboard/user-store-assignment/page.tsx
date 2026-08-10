"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  UserMinus,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { userService } from "@/lib/api/services/user.service";
import type { User, UserStore } from "@/types/user.types";

const MAX_VISIBLE_STORES = 5;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setCurrentPage(page);
  };

  const renderStoreBadges = (stores: UserStore[] | undefined) => {
    if (!stores || stores.length === 0) {
      return <span className="text-sm text-muted-foreground">—</span>;
    }
    const visible = stores.slice(0, MAX_VISIBLE_STORES);
    const remaining = stores.length - visible.length;
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((s) => (
          <Badge key={s.store.id} variant="secondary">
            {s.store.name}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            {t("moreStores", { count: remaining })}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="destructive"
            onClick={() =>
              router.push(
                `/${locale}/dashboard/user-store-assignment/remove`
              )
            }
          >
            <UserMinus className="me-2 h-4 w-4" />
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

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="ps-8"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.user")}</TableHead>
              <TableHead>{t("columns.roles")}</TableHead>
              <TableHead>{t("columns.storesAssigned")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-48" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("noUsers")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{user.name}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge
                            key={role.id}
                            variant="outline"
                            className="capitalize"
                          >
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{renderStoreBadges(user.stores)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-5 w-full" />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            {t("noUsers")}
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUser(user)}
              className="flex flex-col gap-3 rounded-lg border p-4 text-start transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              {user.roles && user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant="outline"
                      className="capitalize"
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("columns.storesAssigned")}
                </p>
                {renderStoreBadges(user.stores)}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center text-sm text-muted-foreground sm:text-start">
            {pagination.total > 0 ? (
              <>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.total
                )}{" "}
                of {pagination.total} entries
              </>
            ) : (
              "0 entries"
            )}
          </div>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">First page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* All-stores dialog */}
      <Dialog
        open={selectedUser !== null}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-4 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {t("storesDialogTitle", { name: selectedUser?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("storesDialogDescription", {
                count: selectedUser?.stores?.length ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>

          {selectedUser?.stores && selectedUser.stores.length > 0 ? (
            <ScrollArea className="flex min-h-0 flex-1 flex-col">
              <div className="grid grid-cols-1 gap-2 pe-3 sm:grid-cols-2">
                {selectedUser.stores.map((s) => (
                  <div
                    key={s.store.id}
                    className="flex items-start gap-2.5 rounded-lg border p-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p
                        className="truncate text-sm font-medium leading-tight"
                        title={s.store.name}
                      >
                        {s.store.name}
                      </p>
                      {s.store.storeId && (
                        <p className="truncate text-xs text-muted-foreground">
                          {s.store.storeId}
                        </p>
                      )}
                      {s.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {s.roles.map((r) => (
                            <Badge
                              key={r.id}
                              variant="outline"
                              className="text-[10px] capitalize"
                            >
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t("noStoresAssigned")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
