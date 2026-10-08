"use client";

import { ExternalLink, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Troubleshooting steps as a ticket kept them: the steps in order, each with
 * the names of its files, then the guide's link and files. Read-only -- the
 * guide may have changed since; this is what the manager tried.
 */
export function TroubleshootingSteps({
  steps,
  linkUrl,
  fileNames = [],
  className,
}: {
  steps: { body: string; files?: { id: number; name: string }[] }[];
  linkUrl: string | null;
  /** Files for the whole guide, known only by name. */
  fileNames?: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {step.body}
            {step.files && step.files.length > 0 && (
              <span className="ms-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {step.files.map((f) => f.name).join(", ")}
              </span>
            )}
          </li>
        ))}
      </ol>
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open the guide (video / manual)
        </a>
      )}
      {fileNames.length > 0 && (
        <p className="text-xs text-muted-foreground">Files: {fileNames.join(", ")}</p>
      )}
    </div>
  );
}
