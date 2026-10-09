"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SearchableSelectOption } from "@/components/shared/searchable-select";
import { PARTICIPANT_ROLES, type ParticipantRole } from "@/types/toolbox-tickets.types";

/** Reader / Responder / Assignee, each with what it can actually do. */
export function useRoleOptions(): SearchableSelectOption<ParticipantRole>[] {
  const t = useTranslations("toolboxTickets.roles");
  return useMemo(
    () => PARTICIPANT_ROLES.map((role) => ({ value: role, label: t(role), hint: t(`${role}Hint`) })),
    [t],
  );
}

export function useRoleLabel() {
  const t = useTranslations("toolboxTickets.roles");
  return (role: string, serverLabel?: string | null) =>
    (PARTICIPANT_ROLES as readonly string[]).includes(role) ? t(role as ParticipantRole) : serverLabel || role;
}
