"use client";

import { AlertTriangle, WifiOff, ServerCrash, ShieldOff, Clock, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TicketsErrorState } from "@/types/maintenance-tickets.types";

const errorIcons: Record<string, React.ElementType> = {
  NETWORK_ERROR: WifiOff,
  TIMEOUT: Clock,
  SERVER_ERROR: ServerCrash,
  NOT_AUTHENTICATED: ShieldOff,
  UNAUTHORIZED: ShieldOff,
  FORBIDDEN: ShieldOff,
};

interface TicketsErrorCardProps {
  error: TicketsErrorState;
  onRetry: () => void;
  onClearError: () => void;
}

export function TicketsErrorCard({ error, onRetry, onClearError }: TicketsErrorCardProps) {
  const t = useTranslations("maintenanceTickets");
  const Icon = errorIcons[error.code] ?? XCircle;

  return (
    <Card className="border-destructive/50">
      <CardHeader className="items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-destructive">{t("error.title")}</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center gap-2">
        {error.retryable && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("error.retry")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClearError}>
          {t("error.dismiss")}
        </Button>
      </CardContent>
    </Card>
  );
}
