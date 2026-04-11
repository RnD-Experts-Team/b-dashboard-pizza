"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, User, MapPin, Phone, Wallet, CalendarDays, FileText, Image as ImageIcon, Clock } from "lucide-react";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { EmployeeRecord } from "@/types/employee.types";
import type { EmployeeStatusRecord, PositionRecord } from "@/types/hiring.types";

interface EmployeeDetailsSheetProps {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: PositionRecord[];
  employeeStatuses: EmployeeStatusRecord[];
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm wrap-break-word">{value ?? "-"}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4 p-4 pt-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

function toPrimaryBadge(value: unknown) {
  const normalized =
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true";
  return normalized ? "Primary" : "Secondary";
}

function legalStatusLabel(status?: string | null) {
  if (!status) return "-";
  if (status.toLowerCase() === "w2") return "W-2";
  return status;
}

function isImageFilePath(path?: string | null) {
  if (!path) return false;
  const cleanPath = path.split("?")[0].toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"].some((ext) =>
    cleanPath.endsWith(ext),
  );
}

function fileNameFromPath(path?: string | null) {
  if (!path) return "file";
  try {
    const url = new URL(path);
    const segment = url.pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : path;
  } catch {
    const segment = path.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : path;
  }
}

export function EmployeeDetailsSheet({
  employeeId,
  open,
  onOpenChange,
  positions,
  employeeStatuses,
}: EmployeeDetailsSheetProps) {
  const { selectedStore } = useSelectedStoreStore();
  const [data, setData] = useState<EmployeeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedEmployeeId = employeeId;

  useEffect(() => {
    if (!open || resolvedEmployeeId === null || !selectedStore?.storeId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    employeeService
      .getEmployeeDetails(selectedStore.storeId, resolvedEmployeeId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load employee details.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedEmployeeId, selectedStore?.storeId]);

  const profile = data?.employee_profile;
  const fullName = profile
    ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")
    : "-";
  const positionName =
    data?.position_id != null
      ? positions.find((p) => p.id === data.position_id)?.position_name ?? `Position #${data.position_id}`
      : "-";
  const statusName =
    data?.emp_status_id != null
      ? employeeStatuses.find((s) => s.id === data.emp_status_id)?.emp_status ?? `Status #${data.emp_status_id}`
      : "-";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Employee #{resolvedEmployeeId ?? "-"}</SheetTitle>
          <SheetDescription>Full details for the selected employee.</SheetDescription>
        </SheetHeader>

        {isLoading && <SheetSkeleton />}

        {error && (
          <Alert variant="destructive" className="mx-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-6 p-4 text-sm">
            <section className="space-y-3">
              <SectionTitle icon={User} label="Profile" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Name" value={fullName} />
                <DetailRow label="Gender" value={profile?.gender ?? "-"} />
                <DetailRow label="Birth Date" value={profile?.birth_date ?? "-"} />
                <DetailRow label="SSN" value={data.SSN_number ?? "-"} />
                <DetailRow label="Position" value={positionName} />
                <DetailRow label="Status" value={statusName} />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={MapPin} label={`Addresses (${data.employee_addresses.length})`} />
              {data.employee_addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No addresses.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_addresses.map((a, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{a.address_line_1 ?? "-"}</span>
                        <Badge variant="outline" className="text-xs">
                          {toPrimaryBadge((a as { is_primary?: unknown }).is_primary)}
                        </Badge>
                      </div>
                      {(a as { address_line_2?: string | null }).address_line_2 && (
                        <p className="text-xs text-muted-foreground">
                          {(a as { address_line_2?: string | null }).address_line_2}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {a.city ?? "-"}, {a.state ?? "-"}, {a.country ?? "-"}
                        {(a as { zip_code?: string | null }).zip_code
                          ? ` ${(a as { zip_code?: string | null }).zip_code}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={Clock} label={`Availability (${data.employee_availability.length})`} />
              {data.employee_availability.length === 0 ? (
                <p className="text-xs text-muted-foreground">No availability.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_availability.map((av, idx) => {
                    const rawDays = av.days as Array<{ day_of_week?: string } | string> | undefined;
                    const dayLabels = (rawDays ?? [])
                      .map((d) =>
                        typeof d === "string" ? d : (d.day_of_week ?? ""),
                      )
                      .filter(Boolean);
                    return (
                      <div key={idx} className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm capitalize">{dayLabels.join(", ") || "-"}</p>
                        {(av as { notes?: string | null }).notes && (
                          <p className="text-xs text-muted-foreground italic">
                            {(av as { notes?: string | null }).notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={Phone} label={`Contacts (${data.employee_contacts.length})`} />
              {data.employee_contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_contacts.map((c, idx) => (
                    <div key={idx} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm capitalize">{c.contact_type ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{c.contact_value ?? "-"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {toPrimaryBadge((c as { is_primary?: unknown }).is_primary)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={Wallet} label="Compensation" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow
                  label="Legal Status"
                  value={legalStatusLabel(data.employee_paychecks_info[0]?.legal_status)}
                />
                <DetailRow
                  label="Paychecks ID"
                  value={data.employee_paychecks_info[0]?.paychecks_id ?? "-"}
                />
                <DetailRow
                  label="Account Type"
                  value={(data.employee_payment_info as { account_type?: string } | null)?.account_type ?? "-"}
                />
                <DetailRow
                  label="Account Number"
                  value={String((data.employee_payment_info as { account_number?: unknown } | null)?.account_number ?? "-")}
                />
                <DetailRow
                  label="Routing Number"
                  value={String((data.employee_payment_info as { routing_number?: unknown } | null)?.routing_number ?? "-")}
                />
                <DetailRow
                  label="Salary Date"
                  value={(data.employee_salary_info as { salary_date?: string } | null)?.salary_date ?? "-"}
                />
                <DetailRow
                  label="Base Pay"
                  value={String((data.employee_salary_info as { base_pay?: unknown } | null)?.base_pay ?? "-")}
                />
                <DetailRow
                  label="Performance Pay"
                  value={String((data.employee_salary_info as { performance_pay?: unknown } | null)?.performance_pay ?? "-")}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={CalendarDays} label={`Status History (${data.employee_status_history.length})`} />
              {data.employee_status_history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status history.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_status_history.map((s, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <p className="text-sm">
                        {
                          employeeStatuses.find((item) => item.id === (s as { status_type_id?: number }).status_type_id)
                            ?.emp_status ?? `Status #${(s as { status_type_id?: number }).status_type_id ?? "-"}`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(s as { status_date?: string }).status_date ?? "-"}
                      </p>
                      {(s as { notes?: string }).notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">{(s as { notes?: string }).notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={ImageIcon} label={`Files (${data.employee_files.length})`} />
              {data.employee_files.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_files.map((f, idx) => {
                    const path = f.file_path || (typeof f.file === "string" ? f.file : "");
                    const isImage = isImageFilePath(path);
                    return (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm">Type #{f.type_id ?? "-"}</p>
                            <p className="text-xs text-muted-foreground break-all">
                              {fileNameFromPath(path)}
                            </p>
                            {f.notes && (
                              <p className="text-xs text-muted-foreground italic">{f.notes}</p>
                            )}
                            {path ? (
                              <a
                                href={path}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary underline-offset-2 hover:underline"
                              >
                                Open file
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">No file URL available.</p>
                            )}
                          </div>
                          {isImage && path && (
                            <img
                              src={path}
                              alt={fileNameFromPath(path)}
                              className="h-16 w-16 rounded-md border object-cover"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={FileText} label={`Notes (${data.employee_notes.length})`} />
              {data.employee_notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_notes.map((n, idx) => (
                    <div key={idx} className="rounded-lg border p-3 text-sm">
                      {(n as { notes?: string }).notes ?? "-"}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
