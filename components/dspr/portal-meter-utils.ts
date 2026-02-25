"use client";

import type { SpeedZone } from "./speedometer-gauge";

export const PERFORMANCE_ZONES: SpeedZone[] = [
  { from: 0, to: 70, color: "#EF4444" },
  { from: 70, to: 85, color: "#EAB308" },
  { from: 85, to: 95, color: "#F97316" },
  { from: 95, to: 100, color: "#22C55E" },
];

export function getPerformanceColor(value: number): string {
  if (value >= 95) return "#22C55E";
  if (value >= 85) return "#F97316";
  if (value >= 70) return "#EAB308";
  return "#EF4444";
}

export function getPerformanceLabel(value: number): string {
  if (value >= 95) return "Excellent";
  if (value >= 85) return "Good";
  if (value >= 70) return "Needs Attention";
  return "Critical";
}

export const LABOR_ZONES: SpeedZone[] = [
  { from: 0, to: 35, color: "#EF4444" },
  { from: 35, to: 42, color: "#EAB308" },
  { from: 42, to: 50, color: "#F97316" },
  { from: 50, to: 70, color: "#22C55E" },
  { from: 70, to: 77, color: "#F97316" },
  { from: 77, to: 85, color: "#EAB308" },
  { from: 85, to: 100, color: "#EF4444" },
];

export function getLaborColor(value: number): string {
  if (value <= 35) return "#EF4444";
  if (value <= 42) return "#EAB308";
  if (value <= 50) return "#F97316";
  if (value <= 70) return "#22C55E";
  if (value <= 77) return "#F97316";
  if (value <= 85) return "#EAB308";
  return "#EF4444";
}

export function getLaborLabel(value: number): string {
  if (value <= 35) return "Critical Low";
  if (value <= 42) return "Low";
  if (value <= 50) return "Below Target";
  if (value <= 70) return "On Target";
  if (value <= 77) return "Above Target";
  if (value <= 85) return "High";
  return "Critical High";
}
