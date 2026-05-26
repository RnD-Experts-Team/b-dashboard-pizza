/* ────────────────────────────────────────────────────────────────────────── */
/*  Screen Project API types                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Station {
  id: number;
  store_id: number;
  name: string;
  room_name: string;
  created_at: string;
  updated_at: string;
}

export interface TokenEntry {
  room: string;
  token: string;
}

export interface ScreenProjectPermissions {
  room_admin: boolean;
  room_join: boolean;
  room_list: boolean;
  room_record: boolean;
  ingress_admin: boolean;
  can_subscribe: boolean;
  can_publish: boolean;
  can_publish_data: boolean;
  can_update_own_metadata: boolean;
  can_subscribe_metrics: boolean;
}

export interface SupervisorTokensResponse {
  server_url: string;
  storeId: string;
  store_id: number;
  identity: string;
  rooms: string[];
  tokens: TokenEntry[];
  permissions: ScreenProjectPermissions;
}

export interface StationTokenResponse {
  token: string;
  server_url: string;
  media?: import("./screen-project-media.types").StationMedia[];
}

export interface ObserverTokenEntry {
  room: string;
  token: string;
  media?: import("./screen-project-media.types").StationMedia[];
}

export interface ObserverTokensResponse {
  server_url: string;
  storeId: string;
  store_id: number;
  identity: string;
  rooms: string[];
  tokens: ObserverTokenEntry[];
  permissions: Record<string, boolean>;
}
