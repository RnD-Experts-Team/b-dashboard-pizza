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
import { AlertCircle, User, MapPin, Phone, Wallet, CalendarDays, FileText, Image as ImageIcon, Clock, IdCard, Award } from "lucide-react";
import { employeeService } from "@/lib/api/services/employee.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { EmployeeRecord } from "@/types/employee.types";
import type { EmployeeStatusRecord, MaritalStatusRecord, PositionRecord } from "@/types/hiring.types";

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
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatusRecord[]>([]);
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

    Promise.all([
      employeeService.getEmployeeDetails(selectedStore.storeId, resolvedEmployeeId),
      maritalStatuses.length === 0
        ? hiringService.getCreateEmployeePage(selectedStore.storeId)
        : Promise.resolve(null),
    ])
      .then(([empRes, pageRes]) => {
        if (cancelled) return;
        setData(empRes.data);
        if (pageRes?.employeeMaritalStatuses) {
          setMaritalStatuses(pageRes.employeeMaritalStatuses);
        }
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
                <DetailRow label="Employment Type" value={data.employement_type ?? "-"} />
                <DetailRow label="T-Shirt Size" value={data.T_shirt_size ?? "-"} />
                {data.marital_status_id != null && (
                  <DetailRow
                    label="Marital Status"
                    value={
                      maritalStatuses.find((ms) => ms.id === data.marital_status_id)
                        ?.marital_status_name ?? `Status #${data.marital_status_id}`
                    }
                  />
                )}
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
              {data.employee_payment_info.length === 0 && data.employee_salary_info.length === 0 ? (
                <p className="text-xs text-muted-foreground">No compensation info.</p>
              ) : (
                <div className="space-y-3">
                  {data.employee_payment_info.map((payment, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Bank Account</span>
                        <Badge variant="outline" className="text-xs">
                          {toPrimaryBadge((payment as { is_primary?: unknown }).is_primary)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DetailRow label="Account Type" value={payment.account_type ?? "-"} />
                        <DetailRow label="Account Number" value={String(payment.account_number ?? "-")} />
                        <DetailRow label="Routing Number" value={String(payment.routing_number ?? "-")} />
                      </div>
                    </div>
                  ))}
                  {data.employee_salary_info.map((salary, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">Salary</span>
                      <div className="grid grid-cols-2 gap-2">
                        <DetailRow label="Salary Date" value={salary.salary_date ?? "-"} />
                        <DetailRow label="Base Pay" value={String(salary.base_pay ?? "-")} />
                        <DetailRow label="Performance Pay" value={String(salary.performance_pay ?? "-")} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={IdCard} label={`Employee IDs (${data.employee_ids?.length ?? 0})`} />
              {!data.employee_ids?.length ? (
                <p className="text-xs text-muted-foreground">No employee IDs.</p>
              ) : (
                <div className="space-y-2">
                  {data.employee_ids.map((eid, idx) => (
                    <div key={idx} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm">{eid.employee_id_type?.type_name ?? `Type #${eid.employee_id_type_id}`}</p>
                        <p className="text-xs text-muted-foreground">{String(eid.id_number)}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {toPrimaryBadge(eid.is_primary)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionTitle icon={Award} label={`Certifications (${data.created_certifications_info?.length ?? 0})`} />
              {!data.created_certifications_info?.length ? (
                <p className="text-xs text-muted-foreground">No certifications.</p>
              ) : (
                <div className="space-y-2">
                  {data.created_certifications_info.map((cert, idx) => (
                    <div key={idx} className="rounded-lg border p-3 text-sm">
                      {cert.certification_name}
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
