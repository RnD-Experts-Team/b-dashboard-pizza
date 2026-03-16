"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, Settings, LogOut, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth/auth.store";
import { LayoutSwitcher } from "./layout-switcher";

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("common");
  const { user, logout } = useAuthStore();
  const [layoutOpen, setLayoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/auth/login`);
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3",
            collapsed && "justify-center px-2"
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar || undefined} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col items-start text-start">
              <span className="text-sm font-medium truncate max-w-35">
                {user?.name || t("user")}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-35">
                {user?.email || t("guestEmail")}
              </span>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.name || t("user")}</p>
            <p className="text-xs text-muted-foreground">
              {user?.email || t("guestEmail")}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard/settings/profile`} className="cursor-pointer">
            <User className="me-2 h-4 w-4" />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard/settings`} className="cursor-pointer">
            <Settings className="me-2 h-4 w-4" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setLayoutOpen(true);
          }}
          className="cursor-pointer"
        >
          <LayoutGrid className="me-2 h-4 w-4" />
          Layout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="me-2 h-4 w-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <LayoutSwitcher open={layoutOpen} onOpenChange={setLayoutOpen} />
    </>
  );
}
