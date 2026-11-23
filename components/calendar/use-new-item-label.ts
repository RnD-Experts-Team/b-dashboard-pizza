"use client";

import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth/auth.store";

/**
 * Only a super admin can add events and tasks (user-requested 2026-11-23); everyone else
 * can only set a reminder for themselves. So the button that opens the add dialog says
 * "New event" for a super admin and "New reminder" for everyone else.
 */
export function useCanAddEvents(): boolean {
  return useAuthStore((s) => s.isSuperAdmin());
}

export function useNewItemLabel(): string {
  const t = useTranslations("calendar");
  return t(useCanAddEvents() ? "newEvent" : "newReminder");
}
