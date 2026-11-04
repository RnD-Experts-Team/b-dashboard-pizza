"use client";

import { useParams } from "next/navigation";
import { ReportBuilder } from "@/components/report-builder/report-builder";

/** A saved template, opened in the builder. */
export default function EditReportPage() {
  const params = useParams();
  const templateId = String(params?.templateId ?? "");
  return (
    // Remount per template so the editor never shows the previous one's state.
    <ReportBuilder key={templateId} templateId={templateId} />
  );
}
