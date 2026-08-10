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
import { cn } from "@/lib/utils";

interface MediaLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  stationNumber: number;
  stationName: string;
  /** Called whenever the media list changes (fetch, set-primary, upload,
   * delete) so the parent can push it live to the station screen. */
  onMediaChange?: (media: StationMedia[]) => void;
  /** Override the sheet content's className — needed when this must render
   * above another very-high-z overlay (e.g. the Drive Thru sheet). */
  contentClassName?: string;
  /** Override the backdrop's className — see contentClassName. */
  overlayClassName?: string;
  /** Override the nested delete-confirmation dialog's className — same reason
   * as contentClassName, needed one level deeper for the delete AlertDialog. */
  alertContentClassName?: string;
  /** Override the delete-confirmation dialog's backdrop className. */
  alertOverlayClassName?: string;
}

export function MediaLibrarySheet({
  open,
  onOpenChange,
  storeId,
  stationNumber,
  stationName,
  onMediaChange,
  contentClassName,
  overlayClassName,
  alertContentClassName,
  alertOverlayClassName,
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
        overlayClassName={overlayClassName}
        className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-120", contentClassName)}
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
              alertContentClassName={alertContentClassName}
              alertOverlayClassName={alertOverlayClassName}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
