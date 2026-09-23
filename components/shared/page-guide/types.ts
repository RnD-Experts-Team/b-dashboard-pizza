import type { LucideIcon } from "lucide-react";

export type GuidePlacement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface GuideStep {
  /** Must match a `data-guide-id` attribute on a DOM element */
  id: string;
  title: string;
  /** Optional icon rendered before the title */
  icon?: LucideIcon;
  description: string;
  /** Preferred side to place the annotation label relative to the target */
  placement: GuidePlacement;
  /** When true: no spotlight/highlight, card is centered on screen (for intro steps) */
  noHighlight?: boolean;
  /** Optional bullet points rendered below the description */
  bullets?: string[];
  /** If set, renders a copyable URL chip below bullets. Provide a path (e.g. /en/store/03795/stations); full URL is constructed at copy time using window.location.origin. */
  copyableUrl?: string;
}
