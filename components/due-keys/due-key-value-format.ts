import type { DueKeyValue } from "@/types/due-key.types";

export function getValueDisplay(v: DueKeyValue | null): { label: string; display: string } {
  if (v == null) return { label: "Value", display: "—" };

  if (v.valueText != null) return { label: "Text Value", display: String(v.valueText) };
  if (v.valueNumber != null) return { label: "Number Value", display: String(v.valueNumber) };
  if (v.valueBoolean != null) return { label: "Boolean Value", display: v.valueBoolean ? "Yes" : "No" };
  if (v.valueJson != null) {
    try {
      return { label: "JSON Value", display: JSON.stringify(v.valueJson, null, 2) };
    } catch {
      return { label: "JSON Value", display: String(v.valueJson) };
    }
  }

  return { label: "Value", display: "—" };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
