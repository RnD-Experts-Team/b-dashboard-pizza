import type { DsprChannelSales } from "@/types/dspr.types";

/** Sales channels shared by the channel-mix and hourly charts. */
export const CHANNELS: { key: keyof DsprChannelSales; label: string; color: string }[] = [
  { key: "royalty_obligation", label: "Register", color: "#FF6B35" },
  { key: "phone_sales", label: "Phone", color: "#0ea5e9" },
  { key: "call_center_sales", label: "Call Center", color: "#14b8a6" },
  { key: "drive_thru_sales", label: "Drive-Thru", color: "#ec4899" },
  { key: "website_sales", label: "Website", color: "#22c55e" },
  { key: "mobile_sales", label: "Mobile", color: "#f59e0b" },
  { key: "doordash_sales", label: "DoorDash", color: "#ef4444" },
  { key: "ubereats_sales", label: "UberEats", color: "#8b5cf6" },
  { key: "grubhub_sales", label: "GrubHub", color: "#94a3b8" },
];

/** Coerce a channel-sales value (number | string) to a number. */
export const num = (v: number | string | null | undefined): number => Number(v) || 0;
