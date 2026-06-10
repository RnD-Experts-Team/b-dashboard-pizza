"use client";

import { WifiOff, ServerCrash, ShieldOff, Clock, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DailyPayErrorState } from "@/types/daily-pay.types";

const errorIcons: Record<string, React.ElementType> = {
  NETWORK_ERROR: WifiOff,
  TIMEOUT: Clock,
  SERVER_ERROR: ServerCrash,
  NOT_AUTHENTICATED: ShieldOff,
  UNAUTHORIZED: ShieldOff,
  FORBIDDEN: ShieldOff,
};

interface DailyPayErrorCardProps {
  error: DailyPayErrorState;
  onRetry: () => void;
  onClearError: () => void;
}

export function DailyPayErrorCard({
  error,
  onRetry,
  onClearError,
}: DailyPayErrorCardProps) {
  const Icon = errorIcons[error.code] ?? XCircle;

  return (
    <Card className="border-destructive/50">
      <CardHeader className="items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-destructive">Something went wrong</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center gap-2">
        {error.retryable && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClearError}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
