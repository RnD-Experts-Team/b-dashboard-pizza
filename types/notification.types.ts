/**
 * Notification System Types
 * Matches the notifications API response structure.
 */

// ============================================================================
// API Types — match the notifications API response exactly
// ============================================================================

export interface NotificationData {
  body: string;
  type: string;
  title: string;
  action_url: string;
  announcement_id?: number;
  [key: string]: unknown;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPaginatedResponse {
  current_page: number;
  data: Notification[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: {
    url: string | null;
    label: string;
    page: number | null;
    active: boolean;
  }[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}
