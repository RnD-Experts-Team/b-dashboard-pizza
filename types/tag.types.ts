/* ────────────────────────────────────────────────────────────────────────── */
/*  Tag Types                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Raw API shape (snake_case) */
export interface ApiTag {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
}

/** Normalised frontend shape (camelCase) */
export interface Tag {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTagPayload {
  name: string;
}

/** Response from GET /tags — may be array or paginated object */
export type ApiTagsListResponse =
  | ApiTag[]
  | { data: ApiTag[] };

export interface TagsListResponse {
  data: Tag[];
}
