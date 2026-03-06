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
import { Plus, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { useStores, useDeleteStore } from "@/lib/hooks/use-stores";
import type { Store } from "@/types/store.types";

export default function StoresPage() {
  const t = useTranslations("stores");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string || "en";
  
  const { stores, pagination, isLoading, handleSearch, handlePageChange, refetch } = useStores();
  const { deleteStore, isDeleting } = useDeleteStore();
  
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    
    try {
      await deleteStore(storeToDelete.id);
      setStoreToDelete(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete store:", error);
    }
  };

  const columns = [
    {
      key: "storeId",
      header: t("columns.id") || "Store ID",
      cell: (store: Store) => (
        <span className="font-medium">{store.storeId}</span>
      ),
    },
    {
      key: "name",
      header: t("columns.name"),
      cell: (store: Store) => (
        <div className="font-medium">{store.name}</div>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (store: Store) => (
        <Badge variant={store.isActive ? "default" : "secondary"}>
          {store.isActive ? t("status.active") : t("status.inactive")}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: t("columns.createdAt"),
      cell: (store: Store) => (
        <span className="text-muted-foreground">
          {new Date(store.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (store: Store) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/stores/${store.id}`)
              }
            >
              <Eye className="me-2 h-4 w-4" />
              {t("actions.view")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                router.push(`/${locale}/dashboard/stores/${store.id}/edit`)
              }
            >
              <Pencil className="me-2 h-4 w-4" />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setStoreToDelete(store)}
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
        <Button onClick={() => router.push(`/${locale}/dashboard/stores/create`)}>
          <Plus className="me-2 h-4 w-4" />
          {t("addStore")}
        </Button>
      </PageHeader>

      <DataTable
        data={stores}
        columns={columns}
        isLoading={isLoading}
        searchable
        searchPlaceholder={t("searchPlaceholder")}
        onSearchChange={handleSearch}
        emptyMessage={t("noStores")}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      <AlertDialog open={!!storeToDelete} onOpenChange={() => setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.description", { name: storeToDelete?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStore}
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
