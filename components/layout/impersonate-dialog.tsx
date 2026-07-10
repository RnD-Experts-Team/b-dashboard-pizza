"use client";

import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { userService } from "@/lib/api/services/user.service";
import { useAuth } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { toast } from "sonner";
import type { User } from "@/types/user.types";

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Reset transient state whenever the dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedUserId(null);
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
        const response = await userService.getUsers({ search, perPage: 20 });
        if (!cancelled) {
          setUsers(response.data.filter((u) => u.id !== currentUserId));
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

  const handleSelect = async (user: User) => {
    if (isImpersonationLoading) return;
    setSelectedUserId(user.id);
    try {
      await impersonateUser(user.id);
      // No need to close/reset state here — impersonateUser hard-navigates
      // the page away on success.
    } catch (error) {
      console.error("Failed to start impersonation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start impersonation."
      );
      setSelectedUserId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full">
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

        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : users.length > 0 ? (
            users.map((user) => {
              const isSelecting = selectedUserId === user.id && isImpersonationLoading;
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={isImpersonationLoading}
                  onClick={() => handleSelect(user)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isImpersonationLoading && "opacity-60 cursor-not-allowed"
                  )}
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
                  {isSelecting && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
