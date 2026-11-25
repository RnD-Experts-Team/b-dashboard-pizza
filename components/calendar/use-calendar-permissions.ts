"use client";

import { useAuthStore } from "@/lib/auth/auth.store";
import { TASK_CREATE_RULE } from "@/lib/calendar/toolbox-write";

/**
 * May this user create a TASK? (FRONTEND_UPDATE_2026-11-24.) Decided by the pizzasys rule for
 * `POST /v1/calendar/tasks`: the `Calendar Tasks` role (held globally) and super admins pass;
 * store managers and everyone else don't. Event and Reminder need no such check.
 *
 * Until the rule exists in the user's auth rules the answer is no (default deny), so only
 * super admins (who bypass the rules) see the Task tab. The selector returns a boolean, so the
 * component re-renders when the rules load.
 */
export function useCanCreateTasks(): boolean {
  return useAuthStore((s) => s.canAccessRoute(TASK_CREATE_RULE));
}
