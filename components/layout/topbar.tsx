"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, PanelLeft, Search, Zap, Megaphone } from "lucide-react";
import { useUIStore } from "@/lib/store/ui.store";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useAnnouncementStore } from "@/lib/store/announcement.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggleAnimated as ThemeToggle } from "@/components/shared/ThemeToggleAnimated";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { showNotificationToast } from "@/components/notifications/notification-toast";
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
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
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

      {/* Notifications */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        {/* Test button — triggers a random slide-in notification */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const types = ['info', 'warning', 'success', 'error'] as const;
            const titles = [
              'New Order Received',
              'Delivery Delayed',
              'Payment Confirmed',
              'Equipment Alert',
            ];
            const messages = [
              'Order #9821 placed for Store #3.',
              'Delivery for Order #4210 is running 15 minutes late.',
              'Payment of $45.99 received for Order #8812.',
              'Refrigerator temperature warning at Store #7.',
            ];
            const idx = Math.floor(Math.random() * types.length);
            const notification = useNotificationStore.getState().addNotification({
              type: types[idx],
              title: titles[idx],
              message: messages[idx],
              priority: 'medium',
            });
            showNotificationToast(notification);
          }}
          aria-label="Trigger test notification"
        >
          <Zap className="h-[1.2rem] w-[1.2rem]" />
        </Button>
        {/* Announcement trigger — simulates receiving a new announcement popup */}
        {/* <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const store = useAnnouncementStore.getState();
            // Pick the first unseen announcement, or the most recent one
            const target =
              store.announcements.find((a) => a.is_pinned) ??
              store.announcements[0];
            if (target) store.setActivePopup(target);
          }}
          aria-label="Trigger test announcement popup"
        >
          <Megaphone className="h-[1.2rem] w-[1.2rem]" />
        </Button> */}
      </div>

      {/* Theme toggle - conditionally rendered */}
      <Feature name="darkMode">
        <ThemeToggle />
      </Feature>
    </header>
  );
}
