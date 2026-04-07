/**
 * Announcement System Types
 * Defines all TypeScript interfaces and types for the announcements feature.
 */

// ============================================================================
// API Types — match the notifications API response exactly
// ============================================================================

export type AnnouncementType = "general" | "maintenance" | "urgent";

export interface Announcement {
  id: number;
  type: AnnouncementType;
  title: string;
  body: string;
  version: string | null;
  is_active: boolean;
  is_pinned: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementPaginatedResponse {
  current_page: number;
  data: Announcement[];
  total: number;
  per_page: number;
  last_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  type: AnnouncementType;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_pinned: boolean;
  version?: string;
}

export interface UpdateAnnouncementPayload {
  title?: string;
  body?: string;
  type?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
  is_pinned?: boolean;
  version?: string;
}

// ============================================================================
// Legacy form types (kept for backwards-compat with create dialog)
// ============================================================================

export type AnnouncementPriority = "normal" | "important" | "urgent";
export type AnnouncementMediaType = "image" | "gif" | "video";

export interface AnnouncementMedia {
  type: AnnouncementMediaType;
  url: string;
  thumbnail?: string;
  alt?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  media?: AnnouncementMedia;
  priority: AnnouncementPriority;
}
