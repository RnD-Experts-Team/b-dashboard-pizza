export type MediaType = "image" | "video";

export interface StationMedia {
  id: number;
  file_name: string;
  type: MediaType;
  /** Public URL to the media file */
  url: string;
  is_primary: boolean;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
}

export interface FinalizeUploadItem {
  upload_id: string;
  file_name: string;
  total_chunks: number;
  total_size: number;
  type: MediaType;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  is_primary?: boolean;
}

export interface BulkCompleteResultItem {
  upload_id: string;
  success: boolean;
  media?: StationMedia;
  error?: string;
}

export interface BulkCompleteResponse {
  results: BulkCompleteResultItem[];
}

export type MediaUploadStatus =
  | "pending"
  | "uploading"
  | "finalizing"
  | "done"
  | "error";

export interface MediaUploadJob {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number;
  status: MediaUploadStatus;
  error?: string;
}
