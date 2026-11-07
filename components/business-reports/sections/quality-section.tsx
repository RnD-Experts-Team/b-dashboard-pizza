"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { V1Span } from "@/components/dashboard-v1/v1-card";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { BrMaintenanceTicketsCard } from "@/components/business-reports/cards/quality/br-maintenance-tickets";
import { BrComplaintsCard } from "@/components/business-reports/cards/quality/br-complaints";
import { BrFeedbacksCard } from "@/components/business-reports/cards/quality/br-feedbacks";
import { BrCleaningReviewCard } from "@/components/business-reports/cards/quality/br-cleaning-review";
import { BrCustomerServiceCard } from "@/components/business-reports/cards/quality/br-customer-service";

const HALF: V1Span = 2;
const TICKET_SPANS: V1Span[] = [HALF];
const FEEDBACK_SPANS: V1Span[] = [HALF, HALF];
const QUALITY_SPANS: V1Span[] = [HALF, HALF];

/** Quality & Voice of Customer over the range: maintenance, complaints, feedback, cleaning, customer service. */
export function QualitySection() {
  const { rangeLabel, params } = useReport();
  // Complaints and employee feedback: `view complaints`, held globally or at every loaded store.
  const canSeeComplaints = useAuthStore((s) => {
    if (s.hasPermission("view complaints")) return true;
    const idOf = new Map(s.overviewStores.map((o) => [o.storeId, o.id]));
    return params.stores.every((code) => s.storePermissions[idOf.get(code) ?? ""]?.has("view complaints") ?? false);
  });
  const tickets = useSection("tickets");
  const feedback = useSection("feedback");
  const quality = useSection("quality");

  return (
    <V1Section category="quality" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={tickets} spans={TICKET_SPANS} label="Maintenance tickets">
        {(data) => <BrMaintenanceTicketsCard data={data} />}
      </SectionSlot>
      {canSeeComplaints && (
        <SectionSlot state={feedback} spans={FEEDBACK_SPANS} label="Complaints & feedback">
          {(data) => (
            <>
              <BrComplaintsCard data={data} />
              <BrFeedbacksCard data={data} />
            </>
          )}
        </SectionSlot>
      )}
      <SectionSlot state={quality} spans={QUALITY_SPANS} label="Quality">
        {(data) => (
          <>
            <BrCleaningReviewCard data={data} />
            <BrCustomerServiceCard data={data} />
          </>
        )}
      </SectionSlot>
    </V1Section>
  );
}
