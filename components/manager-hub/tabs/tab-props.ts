import type { ManagerHubData } from "@/lib/hooks/use-manager-hub";
import type { HubDetail } from "../detail-dialogs";
import type { HubSummary } from "../summary";
import type { HubActions } from "../use-hub-actions";

export interface HubTabProps {
  data: ManagerHubData;
  summary: HubSummary;
  actions: HubActions;
  onDetail: (detail: HubDetail) => void;
  /** True when the anchor day is the real today. */
  isToday: boolean;
  goTab: (tab: "overview" | "tasks" | "debriefs" | "employee-debriefs") => void;
}
