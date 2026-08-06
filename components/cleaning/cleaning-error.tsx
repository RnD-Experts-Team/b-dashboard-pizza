import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CleaningError } from "@/lib/api/services/cleaning.service";

export function CleaningErrorState({
  error,
  onRetry,
}: {
  error: CleaningError;
  onRetry?: () => void;
}) {
  const isSync = error.code === "NOT_SYNCED";
  const isForbidden = error.code === "FORBIDDEN";

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium">
            {isSync
              ? "Not available yet"
              : isForbidden
                ? "No permission"
                : "Something went wrong"}
          </p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
        {onRetry && error.code !== "FORBIDDEN" && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="me-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
