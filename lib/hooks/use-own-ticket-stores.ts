"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth/auth.store";

/**
 * The stores[] a cross-store ticket read must name, or null when the viewer
 * may read every store's tickets (GET /tickets with no store -- the MOS head
 * and super admins, per the pizzasys rule).
 *
 * Everyone else names their own active stores. The server refuses them a read
 * with no store at all, so leaving stores[] off is never "all stores" for them.
 */
export function useOwnTicketStores(): string[] | null {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const canAccessRoute = useAuthStore((s) => s.canAccessRoute);

  return useMemo(
    () =>
      canAccessRoute({ service: "Maintenance", method: "GET", path: "/tickets" })
        ? null
        : overviewStores.filter((s) => s.isActive).map((s) => s.storeId ?? s.id),
    [overviewStores, canAccessRoute],
  );
}
