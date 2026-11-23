import { AlertTriangle, Info, Wrench, type LucideIcon } from "lucide-react";
import {
  KNOWN_ANNOUNCEMENT_TYPES,
  normalizeAnnouncementType,
  type AnnouncementType,
} from "@/types/announcement.types";

/**
 * One place for how an announcement type looks. v1 copy-pasted this table into
 * three files.
 *
 * Types are deliberately neutral (no colour): the icon and the label carry the
 * meaning. The colour of an announcement is its own accent, chosen by the admin.
 */

export interface AnnouncementTypeMeta {
  type: AnnouncementType;
  /** Key under the `announcements` namespace (`t(meta.labelKey)`). */
  labelKey: `types.${AnnouncementType}`;
  icon: LucideIcon;
  /** Pill: soft fill + border + text. */
  pill: string;
  /** Text / icon colour on its own. */
  text: string;
  /** Soft round icon background. */
  iconBg: string;
}

const META: Record<AnnouncementType, AnnouncementTypeMeta> = {
  general: {
    type: "general",
    labelKey: "types.general",
    icon: Info,
    pill: "border-border bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    iconBg: "bg-muted",
  },
  maintenance: {
    type: "maintenance",
    labelKey: "types.maintenance",
    icon: Wrench,
    pill: "border-border bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    iconBg: "bg-muted",
  },
  urgent: {
    type: "urgent",
    labelKey: "types.urgent",
    icon: AlertTriangle,
    pill: "border-border bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    iconBg: "bg-muted",
  },
};

/** The meta for any type string the backend sent; unknown types are "general". */
export function typeMetaOf(type: string | null | undefined): AnnouncementTypeMeta {
  return META[normalizeAnnouncementType(type)];
}

/** Every type the composer offers, in display order. */
export const ANNOUNCEMENT_TYPE_METAS: readonly AnnouncementTypeMeta[] =
  KNOWN_ANNOUNCEMENT_TYPES.map((t) => META[t]);
