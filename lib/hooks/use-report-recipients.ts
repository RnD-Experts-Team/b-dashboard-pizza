"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { userService } from "@/lib/api/services/user.service";
import { isCancelled } from "@/lib/report-builder/errors";

/** One person a schedule can be sent to. */
export interface RecipientUser {
  id: string;
  name: string;
  email: string;
}

/** `forbidden` = the caller may not list users (only admins can); `error` = any other failure. */
export type RecipientsStatus = "idle" | "loading" | "ready" | "forbidden" | "error";

const PAGE_SIZE = 100;
/** A safety stop, not a limit anyone should reach: 20 pages of 100. */
const MAX_PAGES = 20;
const HTTP_FORBIDDEN = 403;

interface UseReportRecipientsResult {
  users: RecipientUser[];
  status: RecipientsStatus;
  reload: () => void;
}

/**
 * The admin user list (`GET /users`) the recipients picker chooses from,
 * fetched once `enabled` turns true (the dialog opens). Every page is read,
 * up to 2 000 people.
 */
export function useReportRecipients(enabled: boolean): UseReportRecipientsResult {
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [status, setStatus] = useState<RecipientsStatus>("idle");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      try {
        const all: RecipientUser[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages && page <= MAX_PAGES) {
          const res = await userService.getUsers({ page, perPage: PAGE_SIZE });
          if (cancelled) return;
          all.push(...res.data.map((u) => ({ id: String(u.id), name: u.name, email: u.email })));
          totalPages = res.meta.totalPages;
          page += 1;
        }
        setUsers(all);
        setStatus("ready");
      } catch (err) {
        if (cancelled || isCancelled(err)) return;
        setStatus(axios.isAxiosError(err) && err.response?.status === HTTP_FORBIDDEN ? "forbidden" : "error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { users, status, reload };
}
