"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, PanelLeft, Search, Megaphone } from "lucide-react";
import { useUIStore } from "@/lib/store/ui.store";
// import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggleAnimated as ThemeToggle } from "@/components/shared/ThemeToggleAnimated";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LuminaEmbed } from "@/components/shared/lumina-embed";
import { Breadcrumbs } from "./breadcrumbs";
import { Feature } from "@/lib/config";

interface TopbarProps {
  onMenuClick?: () => void;
  /** Show the logo in the topbar (used by topnav layout) */
  showLogo?: boolean;
  /** Always show the hamburger menu, even on desktop (topnav layout) */
  alwaysShowMenu?: boolean;
}

export function Topbar({ onMenuClick, showLogo, alwaysShowMenu }: TopbarProps) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { toggleSidebar } = useUIStore();

  return (
    <header
      data-font-scope="primary"
      className="font-heading flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6"
    >
      {/* Logo — shown only in topnav layout */}
      {showLogo && (
        <div className="flex items-center gap-2 me-1">
          <Image
            src="/logo.svg"
            alt="Pizza Dashboard"
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="hidden sm:inline text-sm font-semibold">Pizza Dashboard</span>
        </div>
      )}

      {/* Desktop collapse toggle — hidden in topnav layout */}
      {!alwaysShowMenu && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          onClick={toggleSidebar}
        >
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}

      {/* Menu button — always shown if alwaysShowMenu, otherwise mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className={alwaysShowMenu ? "flex" : "md:hidden"}
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
      {/* <Feature name="search">
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
      </Feature> */}

      {/* AI assistant + Notifications */}
      <div className="flex items-center gap-1">
        {/* <LuminaEmbed /> */}
        <NotificationBell />
      </div>

      {/* Theme toggle - conditionally rendered */}
      <Feature name="darkMode">
        <ThemeToggle />
      </Feature>
    </header>
  );
  
}

