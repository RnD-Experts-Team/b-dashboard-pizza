"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, PanelLeft, Search } from "lucide-react";
import { useUIStore } from "@/lib/store/ui.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggleAnimated as ThemeToggle } from "@/components/shared/ThemeToggleAnimated";
import { Breadcrumbs } from "./breadcrumbs";
import { Feature } from "@/lib/config";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex"
        onClick={toggleSidebar}
      >
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Breadcrumbs - conditionally rendered */}
      <Feature name="breadcrumbs">
        <div className="hidden md:block">
          <Breadcrumbs pathname={pathname} />
        </div>
      </Feature>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search (stub) - conditionally rendered */}
      <Feature name="search">
        <div className="hidden w-full max-w-sm md:block">
          <div className="relative">
            <Search className="absolute inset-s-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("search")}
              className="ps-8"
              disabled
            />
          </div>
        </div>
      </Feature>

      {/* Theme toggle - conditionally rendered */}
      <Feature name="darkMode">
        <ThemeToggle />
      </Feature>
    </header>
  );
}
