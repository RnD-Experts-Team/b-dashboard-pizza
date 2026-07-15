"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployeeOperational } from "@/lib/hooks/use-employee-operational";
import { useEmployeeDebriefHistory } from "@/lib/hooks/use-employee-debriefs";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  User,
  Heart,
  Shirt,
} from "lucide-react";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";
import type { OpStatusHistory, OpEmployeeStore, OpObsession } from "@/types/employee-operational.types";

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Card className="overflow-hidden border-border/50">
      <div className="h-14 bg-muted/40" />
      <CardContent className="p-6 pt-0 -mt-8">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-full border-4 border-background shrink-0" />
          <div className="flex-1 pt-6 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OperationalTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Date</TableHead>
            <TableHead>Metric</TableHead>
            <TableHead className="w-32 text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DebriefTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead className="w-32">Date</TableHead>
            <TableHead className="hidden sm:table-cell">Author</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="w-24 text-right">Attachments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="text-sm text-destructive">{message}</p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  lastPage,
  isLoading,
  onPrev,
  onNext,
}: {
  currentPage: number;
  lastPage: number;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (lastPage <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={currentPage <= 1 || isLoading}>
        Previous
      </Button>
      <span className="text-muted-foreground">Page {currentPage} of {lastPage}</span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={currentPage >= lastPage || isLoading}>
        Next
      </Button>
    </div>
  );
}

function EmployeeProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const storeId = searchParams.get("storeId");
  const employeeIdRaw = searchParams.get("employeeId");
  const employeeIdNum = employeeIdRaw ? parseInt(employeeIdRaw, 10) : null;
  const isValidParams =
    !!storeId &&
    employeeIdNum !== null &&
    !isNaN(employeeIdNum) &&
    employeeIdNum > 0;

  const [opPage, setOpPage] = useState(1);
  const [debriefPage, setDebriefPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<EmployeeDebriefItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    employee,
    entries,
    isLoading: opLoading,
    error: opError,
    currentPage: opCurrentPage,
    lastPage: opLastPage,
    total: opTotal,
    refetch: opRefetch,
    clearError: opClearError,
  } = useEmployeeOperational(
    isValidParams ? storeId : null,
    isValidParams ? employeeIdNum : null,
    opPage,
    {}
  );

  const {
    items,
    isLoading: debriefLoading,
    error: debriefError,
    currentPage: debriefCurrentPage,
    lastPage: debriefLastPage,
    total: debriefTotal,
    refetch: debriefRefetch,
    clearError: debriefClearError,
  } = useEmployeeDebriefHistory(
    isValidParams ? storeId : null,
    isValidParams ? employeeIdNum : null,
    debriefPage
  );

  if (!isValidParams) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            Employee not found. Please navigate here from the employee list.
          </p>
        </div>
      </div>
    );
  }

  const fullName = employee
    ? [employee.first_name, employee.middle_name, employee.last_name]
        .filter(Boolean)
        .join(" ") || `Employee #${employeeIdNum}`
    : `Employee #${employeeIdNum}`;

  const initials = employee
    ? [employee.first_name?.[0], employee.last_name?.[0]]
        .filter(Boolean)
        .join("")
        .toUpperCase()
    : "";

  const statusHistories = (employee?.status_histories ?? []) as OpStatusHistory[];
  const currentStatus = statusHistories[0] ?? null;

  const employeeStores = (employee?.stores ?? []) as OpEmployeeStore[];
  const currentStore = employeeStores[0] ?? null;

  const obsession = employee?.obsession as OpObsession | null;
  const imageUrl = (obsession?.image_url ?? (employee as Record<string, unknown> | null)?.image_url) as string | null ?? null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* ── Employee profile card ── */}
      {opLoading && !employee ? (
        <ProfileSkeleton />
      ) : employee ? (
        <Card className="overflow-hidden border-border/50 shadow-sm">
          {/* Decorative header strip */}
          <div className="h-14 bg-gradient-to-r from-muted/60 via-muted/40 to-muted/20 border-b border-border/40" />

          <CardContent className="p-6 pt-0 -mt-10 relative">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 border-4 border-background shadow ring-1 ring-border/50">
                  <AvatarImage src={imageUrl ?? undefined} alt={fullName} className="object-cover" />
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                    {initials || <User className="h-8 w-8 opacity-40" />}
                  </AvatarFallback>
                </Avatar>
                {employee.employment_type && (
                  <div className="absolute -bottom-2.5 inset-x-0 flex justify-center">
                    <Badge className="text-[10px] px-1.5 py-0 h-4 border-background capitalize shadow-sm">
                      {String(employee.employment_type)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Name + status + meta grid */}
              <div className="flex-1 pt-2 sm:pt-6">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-bold tracking-tight">{fullName}</h1>
                  {currentStatus?.status && (
                    <Badge variant="secondary" className="capitalize text-xs">
                      {currentStatus.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Employee #{employeeIdNum}
                  {currentStore?.store?.store_number
                    ? ` · Store ${currentStore.store.store_number}`
                    : storeId
                    ? ` · Store ${storeId}`
                    : ""}
                </p>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                  {employee.gender && (
                    <InfoItem icon={User} label="Gender" value={capitalize(String(employee.gender))} />
                  )}
                  {obsession?.birth_date && (
                    <InfoItem icon={Calendar} label="Date of Birth" value={formatDate(obsession.birth_date)} />
                  )}
                  {obsession?.t_shirt && (
                    <InfoItem icon={Shirt} label="T-Shirt Size" value={String(obsession.t_shirt)} />
                  )}
                  {obsession?.religion && (
                    <InfoItem icon={Heart} label="Religion" value={capitalize(String(obsession.religion))} />
                  )}
                  {currentStatus && (
                    <InfoItem
                      icon={Briefcase}
                      label="Status Since"
                      value={formatDate(currentStatus.effective_date)}
                    />
                  )}
                  {currentStore?.effective_date && (
                    <InfoItem
                      icon={Building2}
                      label="Joined Store"
                      value={formatDate(currentStore.effective_date)}
                    />
                  )}
                </div>

                {/* Status history strip */}
                {statusHistories.length > 1 && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Status History
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {statusHistories.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs"
                          >
                            <span className="capitalize font-medium">{h.status}</span>
                            {h.effective_date && (
                              <span className="text-muted-foreground">
                                · {formatDate(h.effective_date)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Personal notes */}
                {obsession?.notes && (
                  <>
                    <Separator className="my-4" />
                    <p className="text-xs text-muted-foreground italic">{obsession.notes}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Tabs ── */}
      <Tabs defaultValue="operational">
        <TabsList>
          <TabsTrigger value="operational">
            Operational History
            {!opLoading && !opError && opTotal !== null && opTotal > 0 && (
              <Badge variant="secondary" className="ms-2 text-xs">{opTotal}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="debriefs">
            Debrief Notes
            {!debriefLoading && !debriefError && debriefTotal > 0 && (
              <Badge variant="secondary" className="ms-2 text-xs">{debriefTotal}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Operational History ── */}
        <TabsContent value="operational" className="mt-4" tabIndex={-1}>
          {opError && (
            <ErrorBanner message={opError} onRetry={opRefetch} onDismiss={opClearError} />
          )}

          {opLoading && !entries.length ? (
            <OperationalTableSkeleton />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="w-32 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                        No operational records found for this employee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry, i) => (
                      <TableRow key={`${entry.metric_date}-${entry.column_key}-${i}`}>
                        <TableCell className="text-sm">{formatDate(entry.metric_date)}</TableCell>
                        <TableCell className="text-sm">{entry.column_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {entry.value_numeric != null
                            ? entry.value_numeric
                            : entry.value || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!opError && entries.length > 0 && (
            <Pagination
              currentPage={opCurrentPage}
              lastPage={opLastPage}
              isLoading={opLoading}
              onPrev={() => setOpPage((p) => p - 1)}
              onNext={() => setOpPage((p) => p + 1)}
            />
          )}
        </TabsContent>

        {/* ── Debrief Notes ── */}
        <TabsContent value="debriefs" className="mt-4" tabIndex={-1}>
          {debriefError && (
            <ErrorBanner message={debriefError} onRetry={debriefRefetch} onDismiss={debriefClearError} />
          )}

          {debriefLoading && !items.length ? (
            <DebriefTableSkeleton />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Author</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                    <TableHead className="w-24 text-right">Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No debrief notes found for this employee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const notesPreview = item.notes
                        ? item.notes.length > 80
                          ? item.notes.slice(0, 80) + "…"
                          : item.notes
                        : null;
                      const attachmentCount = item.attachments?.length ?? 0;
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => { setSelectedItem(item); setSheetOpen(true); }}
                        >
                          <TableCell className="font-mono text-sm">{item.id}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.date ?? item.createdAt)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {item.authorName
                              ? <span className="text-sm">{item.authorName}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden max-w-xs truncate lg:table-cell" title={item.notes ?? undefined}>
                            {notesPreview ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {attachmentCount > 0
                              ? <Badge variant="secondary">{attachmentCount}</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!debriefError && items.length > 0 && (
            <Pagination
              currentPage={debriefCurrentPage}
              lastPage={debriefLastPage}
              isLoading={debriefLoading}
              onPrev={() => setDebriefPage((p) => p - 1)}
              onNext={() => setDebriefPage((p) => p + 1)}
            />
          )}
        </TabsContent>
      </Tabs>

      <EmployeeDebriefDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        storeId={storeId}
        debriefId={selectedItem?.id ?? null}
      />
    </div>
  );
}

export default function EmployeeProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <EmployeeProfileContent />
    </Suspense>
  );
}
