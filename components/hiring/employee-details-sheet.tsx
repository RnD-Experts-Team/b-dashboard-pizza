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
import {
  AlertCircle,
  User,
  MapPin,
  Phone,
  Wallet,
  CalendarDays,
  FileText,
  Clock,
  IdCard,
  Building2,
  Briefcase,
  Heart,
} from "lucide-react";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useReferenceCatalogStore } from "@/lib/store/reference-catalog.store";
import type { EmployeeV1DetailRecord } from "@/types/employee.types";

interface EmployeeDetailsSheetProps {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    value === true || value === 1 || value === "1" || value === "true";
  return normalized ? "Primary" : "Secondary";
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function EmployeeDetailsSheet({
  employeeId,
  open,
  onOpenChange,
}: EmployeeDetailsSheetProps) {
  const { selectedStore } = useSelectedStoreStore();
  const { idTypes, attachmentTypes } = useReferenceCatalogStore();
  const [data, setData] = useState<EmployeeV1DetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || employeeId === null || !selectedStore?.storeId) {
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
      .getEmployeeDetailsV1(selectedStore.storeId, employeeId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load employee details.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, employeeId, selectedStore?.storeId]);

  const fullName = data
    ? [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ")
    : "-";

  const currentPosition = data?.positions?.[0]?.position?.label ?? "-";
  const currentMarital = data?.maritals?.[0]?.marital_status?.label ?? "-";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Employee #{employeeId ?? "-"}</SheetTitle>
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
            {/* â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle icon={User} label="Profile" />
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Name" value={fullName} />
                <DetailRow label="Gender" value={data.gender ?? "-"} />
                <DetailRow label="Employment Type" value={data.employment_type ?? "-"} />
                <DetailRow label="Position" value={currentPosition} />
                <DetailRow label="Marital Status" value={currentMarital} />
              </div>
            </section>

            {/* â”€â”€ Obsession (personal info) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {data.obsession && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle icon={FileText} label="Personal Info" />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Birth Date" value={formatDate(data.obsession.birth_date)} />
                    <DetailRow label="T-Shirt Size" value={data.obsession.t_shirt ?? "-"} />
                    <DetailRow label="Religion" value={data.obsession.religion ?? "-"} />
                    <DetailRow label="Race" value={data.obsession.race ?? "-"} />
                    {data.obsession.notes && (
                      <div className="col-span-2">
                        <DetailRow label="Notes" value={data.obsession.notes} />
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* â”€â”€ Status History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={CalendarDays}
                label={`Status History (${data.status_histories.length})`}
              />
              {data.status_histories.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status history.</p>
              ) : (
                <div className="space-y-2">
                  {data.status_histories.map((s, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <p className="text-sm capitalize">{s.status}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(s.effective_date)}
                      </p>
                      {s.store && (
                        <p className="text-xs text-muted-foreground">
                          Store: {s.store.store_number}
                        </p>
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">{s.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Pay History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Wallet}
                label={`Pay History (${data.pay_histories.length})`}
              />
              {data.pay_histories.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pay history.</p>
              ) : (
                <div className="space-y-2">
                  {data.pay_histories.map((p, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <DetailRow label="Base Pay" value={`$${p.base_pay}`} />
                        <DetailRow label="Performance Pay" value={`$${p.performance_pay}`} />
                        <DetailRow
                          label="Effective Date"
                          value={formatDate(p.effective_date)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Contacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Phone}
                label={`Contacts (${data.contacts.length})`}
              />
              {data.contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts.</p>
              ) : (
                <div className="space-y-2">
                  {data.contacts.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        {c.contact_name && (
                          <p className="text-sm font-medium">{c.contact_name}</p>
                        )}
                        <p className="text-sm capitalize">{c.contact_type ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{c.contact_value ?? "-"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {toPrimaryBadge(c.is_primary)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Addresses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={MapPin}
                label={`Addresses (${data.addresses.length})`}
              />
              {data.addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No addresses.</p>
              ) : (
                <div className="space-y-2">
                  {data.addresses.map((a, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        {a.address_name && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {a.address_name}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs ml-auto">
                          {toPrimaryBadge(a.is_primary)}
                        </Badge>
                      </div>
                      <p className="text-sm">{a.address_1 ?? "-"}</p>
                      {a.address_2 && (
                        <p className="text-xs text-muted-foreground">{a.address_2}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {[a.city, a.state, a.zip_code, a.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Availability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Clock}
                label={`Availability (${data.availability_days.length})`}
              />
              {data.availability_days.length === 0 ? (
                <p className="text-xs text-muted-foreground">No availability.</p>
              ) : (
                <div className="space-y-2">
                  {data.availability_days.map((av, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm capitalize">{av.day_of_week}</p>
                        {av.shift_type && (
                          <Badge variant="secondary" className="text-xs">
                            {av.shift_type}
                          </Badge>
                        )}
                      </div>
                      {av.times.length > 0 && (
                        <div className="space-y-0.5">
                          {av.times.map((t, ti) => (
                            <p key={ti} className="text-xs text-muted-foreground">
                              {t.available_from} â€“ {t.available_to}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Financial Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Wallet}
                label={`Financial Info (${data.financial_infos.length})`}
              />
              {data.financial_infos.length === 0 ? (
                <p className="text-xs text-muted-foreground">No financial info.</p>
              ) : (
                <div className="space-y-2">
                  {data.financial_infos.map((f, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <DetailRow label="Account Type" value={f.account_type ?? "-"} />
                        <DetailRow
                          label="Effective Date"
                          value={formatDate(f.effective_date)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Positions History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Briefcase}
                label={`Positions (${data.positions.length})`}
              />
              {data.positions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No position history.</p>
              ) : (
                <div className="space-y-2">
                  {data.positions.map((pos, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <p className="text-sm">{pos.position?.label ?? `Position #${pos.position_id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(pos.effective_date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Store Assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Building2}
                label={`Store Assignments (${data.stores.length})`}
              />
              {data.stores.length === 0 ? (
                <p className="text-xs text-muted-foreground">No store assignments.</p>
              ) : (
                <div className="space-y-2">
                  {data.stores.map((s, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <p className="text-sm">{s.store?.store_number ?? `Store #${s.store_id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(s.effective_date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* â”€â”€ Marital History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <section className="space-y-3">
              <SectionTitle
                icon={Heart}
                label={`Marital History (${data.maritals.length})`}
              />
              {data.maritals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No marital history.</p>
              ) : (
                <div className="space-y-2">
                  {data.maritals.map((m, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <p className="text-sm">
                        {m.marital_status?.label ?? `Marital #${m.marital_id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(m.effective_date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* â”€â”€ Employee IDs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {data.ids.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle
                    icon={IdCard}
                    label={`Employee IDs (${data.ids.length})`}
                  />
                  <div className="space-y-2">
                    {data.ids.map((eid, idx) => {
                      const typeName =
                        eid.id_type_id != null
                          ? (idTypes.find((t) => t.id === eid.id_type_id)?.label ??
                            `ID Type #${eid.id_type_id}`)
                          : "-";
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-sm">{typeName}</p>
                            <p className="text-xs text-muted-foreground">{eid.id_value ?? "-"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {/* â”€â”€ Attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {data.attachments.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <SectionTitle
                    icon={FileText}
                    label={`Attachments (${data.attachments.length})`}
                  />
                  <div className="space-y-2">
                    {data.attachments.map((att, idx) => {
                      const typeName =
                        att.type_id != null
                          ? (attachmentTypes.find((t) => t.id === att.type_id)?.label ??
                            `Type #${att.type_id}`)
                          : "-";
                      return (
                        <div key={idx} className="rounded-lg border p-3 space-y-1">
                          <p className="text-sm">{typeName}</p>
                          {att.file_path && (
                            <a
                              href={att.file_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline-offset-2 hover:underline"
                            >
                              Open file
                            </a>
                          )}
                          {att.notes && (
                            <p className="text-xs text-muted-foreground italic">{att.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
