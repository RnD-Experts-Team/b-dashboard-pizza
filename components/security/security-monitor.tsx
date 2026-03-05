"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  runSecurityAudit,
  getSecurityEvents,
  getSecurityScoreColor,
  getSecurityLevelColor,
} from "@/lib/security/audit";
import {
  exportSecurityAudit,
  exportEventsAsJSON,
  exportEventsAsCSV,
  exportEventsAsMarkdown,
  exportAuditAsJSON,
  copyToClipboard,
  downloadFile,
} from "@/lib/security/export";
import type { SecurityAuditResult, SecurityEvent } from "@/lib/security/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Activity,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
} from "lucide-react";

export function SecurityMonitor() {
  const t = useTranslations("devTools.security");
  const [auditResult, setAuditResult] = useState<SecurityAuditResult | null>(
    null
  );
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAudit = useCallback(() => {
    setIsLoading(true);
    // Small delay to show loading state
    setTimeout(() => {
      const result = runSecurityAudit();
      setAuditResult(result);
      setEvents(getSecurityEvents());
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setEvents(getSecurityEvents());
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCopyAudit = async () => {
    if (!auditResult) return;
    const success = await copyToClipboard(exportAuditAsJSON(auditResult));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyEvents = async () => {
    const success = await copyToClipboard(exportEventsAsJSON(events));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <ShieldCheck className="h-8 w-8 text-green-500" />;
    if (score >= 60) return <Shield className="h-8 w-8 text-yellow-500" />;
    if (score >= 40) return <ShieldAlert className="h-8 w-8 text-orange-500" />;
    return <ShieldX className="h-8 w-8 text-red-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!auditResult) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {getScoreIcon(auditResult.overallScore)}
          <div>
            <h2 className="text-2xl font-bold">{t("securityScore")}</h2>
            <p className="text-muted-foreground">
              {t("lastAudit")}: {formatTimestamp(auditResult.timestamp)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 me-2" />
                {t("export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("exportAuditReport")}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => exportSecurityAudit(auditResult, "json")}
              >
                <FileJson className="h-4 w-4 me-2" />
                {t("exportAsJson")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportSecurityAudit(auditResult, "csv")}
              >
                <FileSpreadsheet className="h-4 w-4 me-2" />
                {t("exportAsCsv")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportSecurityAudit(auditResult, "markdown")}
              >
                <FileText className="h-4 w-4 me-2" />
                {t("exportAsMarkdown")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyAudit}>
                {copied ? (
                  <Check className="h-4 w-4 me-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 me-2" />
                )}
                {t("copyToClipboard")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity
              className={`h-4 w-4 me-2 ${autoRefresh ? "text-green-500" : ""}`}
            />
            {autoRefresh ? t("autoRefreshOn") : t("autoRefreshOff")}
          </Button>
          <Button onClick={runAudit} disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 me-2 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? t("running") : t("runAudit")}
          </Button>
        </div>
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div
                className={`text-5xl font-bold ${getSecurityScoreColor(auditResult.overallScore)}`}
              >
                {auditResult.overallScore}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
            <div className="flex-1">
              <Progress
                value={auditResult.overallScore}
                className="h-3 mb-4"
              />
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{auditResult.summary.passed} {t("passed")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>{auditResult.summary.warnings} {t("warning")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{auditResult.summary.failed} {t("failed")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <HelpCircle className="h-4 w-4 text-gray-500" />
                  <span>{auditResult.summary.unknown} {t("skipped")}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Checks and Events */}
      <Tabs defaultValue="checks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checks">{t("securityChecks")}</TabsTrigger>
          <TabsTrigger value="events">
            {t("securityEvents")}
            {events.length > 0 && (
              <Badge variant="secondary" className="ms-2">
                {events.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {auditResult.checks.map((check) => (
              <Card
                key={check.id}
                className={`border-s-4 ${
                  check.status === "pass"
                    ? "border-s-green-500"
                    : check.status === "fail"
                      ? "border-s-red-500"
                      : check.status === "warning"
                        ? "border-s-yellow-500"
                        : "border-s-gray-500"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.status)}
                      <CardTitle className="text-base">{check.name}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${getSecurityLevelColor(check.level)} text-white text-xs`}
                    >
                      {check.level}
                    </Badge>
                  </div>
                  <CardDescription>{check.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">{check.details}</p>
                  {check.recommendation && (
                    <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {check.recommendation}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {check.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("recentSecurityEvents")}</CardTitle>
                <CardDescription>
                  {t("securityEventsDescription")}
                </CardDescription>
              </div>
              {events.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 me-2" />
                      {t("exportEvents")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const content = exportEventsAsJSON(events);
                        downloadFile(
                          content,
                          `security-events-${new Date().toISOString().slice(0, 10)}.json`,
                          "application/json"
                        );
                      }}
                    >
                      <FileJson className="h-4 w-4 me-2" />
                      {t("downloadJson")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const content = exportEventsAsCSV(events);
                        downloadFile(
                          content,
                          `security-events-${new Date().toISOString().slice(0, 10)}.csv`,
                          "text/csv"
                        );
                      }}
                    >
                      <FileText className="h-4 w-4 me-2" />
                      {t("downloadCsv")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const content = exportEventsAsMarkdown(events);
                        downloadFile(
                          content,
                          `security-events-${new Date().toISOString().slice(0, 10)}.md`,
                          "text/markdown"
                        );
                      }}
                    >
                      <FileText className="h-4 w-4 me-2" />
                      {t("downloadMarkdown")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => copyToClipboard(exportEventsAsJSON(events))}
                    >
                      <Copy className="h-4 w-4 me-2" />
                      {t("copyToClipboard")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noSecurityEvents")}</p>
                  <p className="text-sm">
                    {t("eventsWillAppear")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-100">
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 border rounded-lg ${
                          event.level === "critical" || event.level === "high"
                            ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                            : event.level === "medium"
                              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${getSecurityLevelColor(event.level)} text-white`}
                            >
                              {event.level}
                            </Badge>
                            <Badge variant="outline">{event.type}</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(event.timestamp)}
                          </div>
                        </div>
                        <p className="mt-2 text-sm">{event.message}</p>
                        {event.details && (
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                        {event.source && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Source: {event.source}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
