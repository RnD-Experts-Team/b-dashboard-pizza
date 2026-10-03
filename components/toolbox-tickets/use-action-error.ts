"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { parseTicketError, type TicketError } from "@/lib/toolbox-tickets/errors";
import { useStatusLabel } from "./ticket-status-badge";

/**
 * Toasts a failed ticket action in the most useful words we have. The hook
 * that ran it has already re-fetched, so the buttons on screen are fresh.
 *   ALREADY_IN_STATUS  → a double-click; say so quietly.
 *   ILLEGAL_TRANSITION → list what WOULD work (error.allowed).
 *   FORBIDDEN          → the server's sentence (it names the ability).
 */
export function useActionError() {
  const t = useTranslations("toolboxTickets.actionErrors");
  const statusLabel = useStatusLabel();

  return useCallback(
    (err: unknown): TicketError => {
      const parsed = parseTicketError(err);
      switch (parsed.code) {
        case "TICKET_ALREADY_IN_STATUS":
          toast.info(t("alreadyInStatus"));
          break;
        case "TICKET_ILLEGAL_TRANSITION":
          toast.error(parsed.message, {
            description: parsed.allowed?.length
              ? t("allowed", { statuses: parsed.allowed.map((s) => statusLabel(s)).join(", ") })
              : undefined,
          });
          break;
        case "TICKET_FORBIDDEN":
          toast.error(parsed.message, { description: t("forbidden") });
          break;
        case "NOT_FOUND":
          toast.error(t("notFound"));
          break;
        default:
          toast.error(parsed.message);
      }
      return parsed;
    },
    [t, statusLabel],
  );
}
