import type { IssueKey } from "@/lib/api/services/maintenance-workflow.service";
import type { TicketIssueV2, WorkflowResult } from "@/types/maintenance-v2";

/** Runs one workflow step on the selected issue (useTicketPage().act). */
export type RunStep = (fn: (key: IssueKey) => Promise<WorkflowResult>) => Promise<WorkflowResult>;

/** What every step dialog receives. */
export interface StepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: TicketIssueV2;
  run: RunStep;
  /** Store number of the ticket (the technician ranking and the share text). */
  storeNumber: string | null;
  /** Holds the MOS workflow rules at this store (the office view). */
  isMos: boolean;
}
