"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { userService } from "@/lib/api/services/user.service";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { toast } from "sonner";
import type { User } from "@/types/user.types";

/** Super admins are never valid impersonation targets — prevents one admin
 * account impersonating another admin's account. */
function isSuperAdminUser(user: User): boolean {
  return (user.roles ?? []).some((r) => r.name === "super-admin");
}

interface ImpersonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
}

export function ImpersonateDialog({ open, onOpenChange }: ImpersonateDialogProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { impersonateUser, isImpersonationLoading } = useAuth();

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Set once a user is picked from the list — renders the confirmation step.
  // Impersonation only actually starts once the user confirms from there.
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Reset transient state whenever the dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setPendingUser(null);
    }
  }, [open]);

  // Debounced search — mirrors the pattern used elsewhere in this app
  // (e.g. the users list page): local state + setTimeout, no shared hook.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await userService.getUsers({ search, perPage: 1000 });
        if (!cancelled) {
          setUsers(
            response.data.filter(
              (u) => u.id !== currentUserId && !isSuperAdminUser(u)
            )
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch users:", error);
          toast.error("Failed to load users.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, open, currentUserId]);

  const handleConfirm = async () => {
    if (!pendingUser || isImpersonationLoading) return;
    try {
      await impersonateUser(pendingUser.id);
      // No need to close/reset state here — impersonateUser hard-navigates
      // the page away on success.
    } catch (error) {
      console.error("Failed to start impersonation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start impersonation."
      );
      setPendingUser(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full">
        {pendingUser ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm impersonation</DialogTitle>
              <DialogDescription>
                You&apos;ll act as this user across the dashboard until you exit
                impersonation. This includes their permissions and store access.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={pendingUser.avatar || undefined} alt={pendingUser.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(pendingUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{pendingUser.name}</p>
                <p className="truncate text-xs text-muted-foreground">{pendingUser.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This action may be logged for audit purposes.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isImpersonationLoading}
                onClick={() => setPendingUser(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isImpersonationLoading}>
                {isImpersonationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Impersonate {pendingUser.name}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Impersonate User</DialogTitle>
              <DialogDescription>
                Select a user to view the dashboard as them. You can switch back at any time.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="ps-9"
                autoFocus
              />
            </div>

            <div className="h-[360px] overflow-y-auto space-y-1">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setPendingUser(user)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.avatar || undefined} alt={user.name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No users found.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
