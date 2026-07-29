"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScreenProjectMedia } from "@/lib/hooks/use-screen-project-media";
import type { StationMedia } from "@/types/screen-project-media.types";
import { MediaGrid } from "./media-grid";
import { MediaUploadDropzone } from "./media-upload-dropzone";

interface MediaLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  stationNumber: number;
  stationName: string;
  /** Called whenever the media list changes (fetch, set-primary, upload,
   * delete) so the parent can push it live to the station screen. */
  onMediaChange?: (media: StationMedia[]) => void;
}

export function MediaLibrarySheet({
  open,
  onOpenChange,
  storeId,
  stationNumber,
  stationName,
  onMediaChange,
}: MediaLibrarySheetProps) {
  const {
    mediaItems,
    uploadJobs,
    isLoading,
    isDeleting,
    hasFetched,
    fetchMedia,
    uploadFiles,
    setPrimary,
    deleteMedia,
  } = useScreenProjectMedia(storeId, stationNumber);

  // Fetch media on first open only
  useEffect(() => {
    if (open && !hasFetched) {
      fetchMedia();
    }
  }, [open, hasFetched, fetchMedia]);

  // Push the media list up whenever it changes so the station reflects
  // primary/upload/delete changes live (only meaningful once fetched).
  useEffect(() => {
    if (hasFetched) onMediaChange?.(mediaItems);
  }, [mediaItems, hasFetched, onMediaChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-120 flex-col gap-0 p-0 sm:max-w-120"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="truncate text-sm font-semibold">
              Media Library — {stationName}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Upload dropzone — always visible at top */}
        <div className="shrink-0 border-b px-4 py-3">
          <MediaUploadDropzone
            uploadJobs={uploadJobs}
            onUploadFiles={uploadFiles}
          />
        </div>

        {/* Scrollable media grid */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-3">
            <MediaGrid
              items={mediaItems}
              isLoading={isLoading}
              isDeleting={isDeleting}
              onSetPrimary={setPrimary}
              onDelete={deleteMedia}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
