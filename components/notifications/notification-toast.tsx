"use client";

import { toast } from "sonner";
import type { Notification } from "@/types/notification.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Megaphone,
  X,
} from "lucide-react";

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
  announcement: Megaphone,
};

const colorMap = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  success: "text-green-600 dark:text-green-400",
  error: "text-destructive",
  announcement: "text-purple-600 dark:text-purple-400",
};

export function showNotificationToast(
  notification: Notification,
  onClickOpen?: () => void
) {
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
        {(() => {
          const Icon = iconMap[notification.type] ?? Info;
          return <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", colorMap[notification.type])} />;
        })()}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {notification.message}
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
