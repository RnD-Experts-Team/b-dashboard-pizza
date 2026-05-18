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
import { MediaGrid } from "./media-grid";
import { MediaUploadDropzone } from "./media-upload-dropzone";

interface MediaLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  stationNumber: number;
  stationName: string;
}

export function MediaLibrarySheet({
  open,
  onOpenChange,
  storeId,
  stationNumber,
  stationName,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
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
