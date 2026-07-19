"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { MediaUploadJob } from "@/types/screen-project-media.types";

const ACCEPTED_MIME_PREFIXES = ["image/", "video/"];

function isAccepted(file: File) {
  return ACCEPTED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
}

interface MediaUploadDropzoneProps {
  uploadJobs: MediaUploadJob[];
  onUploadFiles: (files: File[]) => void;
}

export function MediaUploadDropzone({
  uploadJobs,
  onUploadFiles,
}: MediaUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(isAccepted);
    if (valid.length > 0) onUploadFiles(valid);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const activeJobs = uploadJobs.filter((j) => j.status !== "done");

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload media files"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors",
          isDragging
            ? "border-primary/60 bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-accent",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Click to upload</span>{" "}
          or drag and drop
        </p>
        <p className="text-xs text-muted-foreground/70">Images and videos accepted</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          // Reset value so the same file can be re-selected
          onClick={(e) => ((e.target as HTMLInputElement).value = "")}
        />
      </div>

      {/* Active upload jobs */}
      {activeJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeJobs.map((job) => {
            const pct =
              job.totalChunks > 0
                ? Math.round((job.uploadedChunks / job.totalChunks) * 100)
                : 0;
            return (
              <div
                key={job.uploadId}
                className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 truncate text-xs text-foreground">
                    {job.fileName}
                  </span>
                  {job.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  ) : job.status === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </div>

                {job.status === "error" ? (
                  <p className="text-[0.65rem] text-red-400">
                    {job.error ?? "Upload failed"}
                  </p>
                ) : job.status === "finalizing" ? (
                  <p className="text-[0.65rem] text-muted-foreground">
                    Finalizing…
                  </p>
                ) : job.status === "uploading" ? (
                  <>
                    <Progress value={pct} className="h-1" />
                    <p className="text-[0.65rem] text-muted-foreground">
                      {job.uploadedChunks}/{job.totalChunks} chunks
                    </p>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
