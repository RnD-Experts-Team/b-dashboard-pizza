"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/lib/store/ui.store";
import { FloatingDebriefButton } from "./floating-debrief-button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { sidebarCollapsed, layoutVariant } = useUIStore();

  /* Shared mobile sidebar drawer — used by every variant */
  const mobileSheet = (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  );

  /* ────────────────────────────────────────────────────────────────── */
  /*  Classic — original: sidebar | topbar + content                   */
  /* ────────────────────────────────────────────────────────────────── */
  if (layoutVariant === "classic") {
    return (
      <div className="flex h-screen overflow-hidden bg-muted/40">
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        {mobileSheet}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6 pb-2">
            <div className={cn("mx-auto w-full transition-[max-width] duration-300", sidebarCollapsed ? "max-w-400" : "max-w-7xl")}>{children}</div>
          </main>
        </div>
        <FloatingDebriefButton />
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  Inset — sidebar full-height, content area is an inset card       */
  /* ────────────────────────────────────────────────────────────────── */
  if (layoutVariant === "inset") {
    return (
      <div className="flex h-screen overflow-hidden bg-muted/40">
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        {mobileSheet}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <div className="flex-1 overflow-auto p-3 md:p-4">
            <main className={cn("h-full w-full rounded-xl bg-background shadow-sm ring-1 ring-border/50 overflow-auto mx-auto transition-[max-width] duration-300", sidebarCollapsed ? "max-w-400" : "max-w-7xl")}>
              <div className="px-4 py-4 md:px-6 md:py-6">
                {children}
              </div>
            </main>
          </div>
        </div>
        <FloatingDebriefButton />
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  Floating — sidebar & content both float with rounded corners     */
  /* ────────────────────────────────────────────────────────────────── */
  if (layoutVariant === "floating") {
    return (
      <div className="flex h-screen overflow-hidden bg-muted/50 p-2 md:p-3 gap-2 md:gap-3">
        {/* Floating sidebar */}
        <div className="hidden md:flex">
          <div className="rounded-2xl bg-sidebar shadow-md ring-1 ring-border/30 overflow-hidden">
            <Sidebar collapsed={sidebarCollapsed} />
          </div>
        </div>
        {mobileSheet}
        {/* Floating content panel */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-background shadow-md ring-1 ring-border/30">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6 pb-2">
            <div className={cn("mx-auto w-full transition-[max-width] duration-300", sidebarCollapsed ? "max-w-400" : "max-w-7xl")}>{children}</div>
          </main>
        </div>
        <FloatingDebriefButton />
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  Top Nav — no sidebar on desktop; nav accessed via hamburger sheet */
  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40">
      {/* Always show hamburger-driven sidebar via sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <Topbar
        onMenuClick={() => setMobileOpen(true)}
        showLogo
        alwaysShowMenu
      />
      <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6 pb-2">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
      <FloatingDebriefButton />
    </div>
  );
}
