/**
 * Announcement System Types
 * Defines all TypeScript interfaces and types for the announcements feature.
 */

// ============================================================================
// Core Types
// ============================================================================

export type AnnouncementMediaType = "image" | "gif" | "video";

export type AnnouncementPriority = "normal" | "important" | "urgent";

// ============================================================================
// Entity Types
// ============================================================================

export interface AnnouncementMedia {
  type: AnnouncementMediaType;
  url: string;
  /** Thumbnail URL for videos */
  thumbnail?: string;
  alt?: string;
}

export interface AnnouncementAuthor {
  name: string;
  role: string;
  avatar?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: AnnouncementMedia;
  author: AnnouncementAuthor;
  createdAt: string;
  priority: AnnouncementPriority;
  seen: boolean;
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  media?: AnnouncementMedia;
  priority: AnnouncementPriority;
}

// ============================================================================
// State Types
// ============================================================================

export interface AnnouncementState {
  announcements: Announcement[];
  /** The announcement currently shown in the popup (null if none) */
  activePopupAnnouncement: Announcement | null;
}

export interface AnnouncementActions {
  addAnnouncement: (input: CreateAnnouncementInput) => Announcement;
  markAsSeen: (id: string) => void;
  markAllAsSeen: () => void;
  setActivePopup: (announcement: Announcement | null) => void;
}
