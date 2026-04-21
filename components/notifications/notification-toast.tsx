"use client";

import { toast } from "sonner";
import type { Notification } from "@/types/notification.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Info,
  AlertTriangle,
  Megaphone,
  Bell,
  X,
} from "lucide-react";

function getToastVisuals(type: string) {
  if (type.startsWith("announcement")) {
    return { Icon: Megaphone, color: "text-purple-600 dark:text-purple-400" };
  }
  if (type.includes("warning") || type.includes("alert")) {
    return { Icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400" };
  }
  if (type.includes("error") || type.includes("fail")) {
    return { Icon: AlertTriangle, color: "text-destructive" };
  }
  if (type.includes("info")) {
    return { Icon: Info, color: "text-blue-600 dark:text-blue-400" };
  }
  return { Icon: Bell, color: "text-blue-600 dark:text-blue-400" };
}

/** Strip HTML tags for plain-text toast preview */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function showNotificationToast(
  notification: Notification,
  onClickOpen?: () => void
) {
  const { Icon, color } = getToastVisuals(notification.type);

  toast.custom(
    (t) => (
      <div
        className={cn(
          "flex items-start gap-3 w-89 rounded-lg border bg-background p-4 shadow-lg cursor-pointer",
        )}
        onClick={() => {
          toast.dismiss(t);
          onClickOpen?.();
        }}
      >
        {/* Icon */}
        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", color)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {stripHtml(notification.body)}
          </p>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 -mt-1 -me-1"
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t);
          }}
          aria-label="Close notification"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    ),
    {
      duration: 5000,
      position: "top-right",
    }
  );
}
