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
  description: string;
  /** Preferred side to place the annotation label relative to the target */
  placement: GuidePlacement;
  /** When true: no spotlight/highlight, card is centered on screen (for intro steps) */
  noHighlight?: boolean;
  /** Optional bullet points rendered below the description */
  bullets?: string[];
}
