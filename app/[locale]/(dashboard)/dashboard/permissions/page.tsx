"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { Plus, MoreHorizontal, Trash2, Edit, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  usePermissions,
  useCreatePermission,
  useDeletePermission,
  useUpdatePermission,
} from "@/lib/hooks/use-permissions";
import type { Permission } from "@/types/role.types";

const createPermissionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  guardName: z.enum(["web", "api"] as const),
});

const updatePermissionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

const cancelErrorPattern = /cancel(?:ed|led)|abort(?:ed|error)?/i;

function isCanceledError(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (
    error instanceof Error &&
    (error.name === "CanceledError" || cancelErrorPattern.test(error.message))
  ) {
    return true;
  }
  if (typeof error === "string") {
    return cancelErrorPattern.test(error);
  }
  return false;
}

function isDisplayableErrorMessage(message: string | null | undefined): message is string {
  return Boolean(message && !cancelErrorPattern.test(message));
}

function getErrorMessage(error: unknown): string | null {
  if (isCanceledError(error)) return null;
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return null;
}

type FormValues = z.infer<typeof createPermissionSchema>;
type UpdateFormValues = z.infer<typeof updatePermissionSchema>;

export default function PermissionsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permissionToEdit, setPermissionToEdit] = useState<Permission | null>(null);
  const [permissionToDelete, setPermissionToDelete] = useState<Permission | null>(null);
  const [editUiError, setEditUiError] = useState<string | null>(null);
  const [actionUiError, setActionUiError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { permissions, isLoading, error, search, pagination, goToPage, refetch } = usePermissions();
  const { isCreating, error: createError, createPermission } = useCreatePermission();
  const { isUpdating, error: updateError, update, clearErrors: clearUpdateErrors } =
    useUpdatePermission();
  const { isDeleting, deletePermission } = useDeletePermission();

  const form = useForm<FormValues>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: {
      name: "",
      guardName: "web",
    },
  });

  const editForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updatePermissionSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (!editDialogOpen || !permissionToEdit) return;

    editForm.reset({
      name: permissionToEdit.name,
    });
    setEditUiError(null);
    clearUpdateErrors();
  }, [editDialogOpen, permissionToEdit, editForm, clearUpdateErrors]);

  const handleSearch = () => {
    setActionUiError(null);
    search(searchTerm);
  };

  const onSubmit = async (data: FormValues) => {
    setActionUiError(null);
    try {
      await createPermission({
        name: data.name,
        guardName: data.guardName,
      });
      form.reset();
      setCreateDialogOpen(false);
      // Refetch the table from the server to get fresh data
      refetch();
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      if (message) {
        setActionUiError(message);
      }
    }
  };

  const onEditSubmit = async (data: UpdateFormValues) => {
    if (!permissionToEdit) return;

    setEditUiError(null);
    setActionUiError(null);

    try {
      await update(permissionToEdit.id, {
        name: data.name,
      });
      setEditDialogOpen(false);
      setPermissionToEdit(null);
      editForm.reset();
      refetch();
    } catch (submitError) {
      const message =
        getErrorMessage(submitError) ||
        (isDisplayableErrorMessage(updateError) ? updateError : "Failed to update permission.");
      if (message) {
        setEditUiError(message);
      }
    }
  };

  const handleDelete = async () => {
    if (permissionToDelete) {
      setActionUiError(null);
      try {
        await deletePermission(permissionToDelete.id);
        setDeleteDialogOpen(false);
        setPermissionToDelete(null);
      } catch (deleteError) {
        const message = getErrorMessage(deleteError) || "Failed to delete permission.";
        if (message) {
          setActionUiError(message);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Permissions</h1>
          <p className="text-muted-foreground">
            Manage system permissions for access control.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Permission
        </Button>
      </div>

      {isDisplayableErrorMessage(error) && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isDisplayableErrorMessage(actionUiError) && (
        <Alert variant="destructive">
          <AlertDescription>{actionUiError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                A list of all permissions in the system.
              </CardDescription>
            </div>
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full lg:w-64"
              />
              <Button variant="outline" size="icon" onClick={handleSearch} className="shrink-0">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No permissions found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-170">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Guard</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((permission, index) => (
                    <TableRow key={permission.id || `permission-${index}`}>
                      <TableCell className="font-medium">
                        {permission.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{permission.guardName}</Badge>
                      </TableCell>
                      <TableCell>
                        {permission.createdAt && !isNaN(new Date(permission.createdAt).getTime())
                          ? format(new Date(permission.createdAt), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setPermissionToEdit(permission);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setPermissionToDelete(permission);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {permissions.length > 0 && pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} permissions
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-muted-foreground sm:hidden">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="hidden items-center gap-1 sm:flex">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="min-w-10"
                      >
                        {pageNum}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Permission Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Create Permission</DialogTitle>
            <DialogDescription>
              Create a new permission for access control.
            </DialogDescription>
          </DialogHeader>

          {isDisplayableErrorMessage(createError) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createError}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="manage users" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use lowercase with spaces (e.g., &quot;manage users&quot;).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guardName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guard Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select guard name" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="web">web</SelectItem>
                        {/* <SelectItem value="api">api</SelectItem> */}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose one: web or api (default: web).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isCreating}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating} className="w-full sm:w-auto">
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Permission Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setPermissionToEdit(null);
            setEditUiError(null);
            clearUpdateErrors();
            editForm.reset({ name: "" });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>
              Update this permission. Name is required.
            </DialogDescription>
          </DialogHeader>

          {(isDisplayableErrorMessage(editUiError) || isDisplayableErrorMessage(updateError)) && (
            <Alert variant="destructive">
              <AlertDescription>{editUiError || updateError}</AlertDescription>
            </Alert>
          )}

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="manage users" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use lowercase with spaces (e.g., &quot;manage users&quot;).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={isUpdating}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setPermissionToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{permissionToDelete?.name}&quot;?
              This action cannot be undone and may affect roles using this permission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
