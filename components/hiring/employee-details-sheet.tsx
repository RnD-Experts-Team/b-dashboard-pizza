"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  BarChart2,
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
  Shirt,
  Calendar,
  Mail,
  User,
  Paperclip,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { employeeService } from "@/lib/api/services/employee.service";
import { useReferenceCatalogStore } from "@/lib/store/reference-catalog.store";
import type { EmployeeV1DetailRecord } from "@/types/employee.types";

const STORAGE_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${STORAGE_BASE}/storage/${path}`;
}

function formatFileSize(bytes?: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EmployeeDetailsSheetProps {
  employeeId: number | null;
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium wrap-break-word">{value ?? "-"}</span>
    </div>
  );
}

function DataCard({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden shadow-sm border-border/50">
      <div className="bg-muted/30 border-b border-border/50 px-4 py-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <CardContent className="p-4 grid gap-3">
        {children}
      </CardContent>
    </Card>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-6 p-6 pt-2">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
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
    const datePart = dateStr.split("T")[0] ?? dateStr;
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const local = new Date(y, (m as number) - 1, d);
    return local.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatSSN(ssn: string | null | undefined, visible: boolean): string {
  if (!ssn) return "-";
  const cleaned = ssn.replace(/\D/g, "");
  if (cleaned.length !== 9) return ssn;
  const formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
  return visible ? formatted : `XXX-XX-${cleaned.slice(5, 9)}`;
}

export function EmployeeDetailsSheet({
  employeeId,
  storeId,
  open,
  onOpenChange,
}: EmployeeDetailsSheetProps) {
  const locale = (useParams()?.locale as string) || "en";
  const { idTypes, attachmentTypes } = useReferenceCatalogStore();
  const [data, setData] = useState<EmployeeV1DetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssnVisible, setSsnVisible] = useState(false);

  useEffect(() => {
    if (!open || employeeId === null || !storeId) {
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
      .getEmployeeDetailsV1(storeId, employeeId)
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
  }, [open, employeeId, storeId]);

  const fullName = data
    ? [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ")
    : "-";

  const currentPosition = data?.positions?.[0]?.position?.label ?? "-";
  const currentMarital = data?.maritals?.[0]?.marital_status?.label ?? "Single";
  const initials = [data?.first_name?.charAt(0), data?.last_name?.charAt(0)].filter(Boolean).join("").toUpperCase();

  const contacts = data?.contacts ?? [];
  const addresses = data?.addresses ?? [];
  const stores = data?.stores ?? [];
  const statusHistories = data?.status_histories ?? [];
  const payHistories = data?.pay_histories ?? [];
  const financialInfos = data?.financial_infos ?? [];
  const ids = data?.ids ?? [];
  const availabilityDays = data?.availability_days ?? [];
  const attachments = data?.attachments ?? [];

  const hasContactCard = contacts.length > 0 || addresses.length > 0;
  const hasEmploymentCard = stores.length > 0 || statusHistories.length > 0;
  const hasPayCard = payHistories.length > 0 || financialInfos.length > 0;
  const hasIdsOrAvailability = ids.length > 0 || availabilityDays.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-xl p-0 gap-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Employee #{employeeId ?? "-"}</SheetTitle>
          <SheetDescription>Full details for the selected employee.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-6 space-y-6">
            {isLoading && <SheetSkeleton />}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {data && (
              <>
                {/* ID Card Style Profile */}
                <Card className="relative overflow-hidden border-border/50 shadow-sm">
                  {/* Decorative background header strip */}
                  <div className="h-16 bg-muted/50 absolute inset-x-0 top-0 border-b border-border/50" />
                  
                  <CardContent className="p-6 pt-10 relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    <div className="relative shrink-0">
                      <Avatar className="h-24 w-24 border-4 border-background shadow-sm ring-1 ring-border/50">
                        <AvatarImage src={data.obsession?.image_url || undefined} alt={fullName} className="object-cover" />
                        <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                          {initials || <User className="h-10 w-10 opacity-50" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-3 inset-x-0 flex justify-center">
                        <Badge className="shadow-sm capitalize shrink-0 text-[10px] px-1.5 py-0 border-background">
                          {data.employment_type || "W2"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 space-y-1.5 text-center sm:text-left mt-2 sm:mt-0">
                      <h2 className="text-xl font-bold tracking-tight">{fullName}</h2>
                      <p className="font-medium text-primary text-sm flex items-center justify-center sm:justify-start gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        {currentPosition}
                      </p>

                      <div className="flex justify-center sm:justify-start flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-muted-foreground select-text">
                        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> {data.gender ?? "-"}</span>
                        <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5"/> {currentMarital}</span>
                      </div>
                    </div>

                    {data.ssn && (
                      <div className="sm:absolute top-4 right-4 bg-background/80 backdrop-blur rounded px-2.5 py-1.5 text-xs border border-border/50 flex flex-col items-center sm:items-end">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5 tracking-wider">SSN</span>
                        <button
                          onClick={() => setSsnVisible(!ssnVisible)}
                          className="font-mono hover:text-primary transition-colors cursor-pointer select-text text-sm"
                        >
                          {formatSSN(data.ssn, ssnVisible)}
                        </button>
                      </div>
                    )}
                  </CardContent>

                  {/* Operational History navigation */}
                  {storeId && employeeId !== null && (
                    <div className="border-t border-border/50 px-6 py-3">
                      <Link
                        href={`/${locale}/dashboard/employee-profile?storeId=${encodeURIComponent(storeId)}&employeeId=${employeeId}`}
                      >
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <BarChart2 className="h-4 w-4" />
                          Operational History
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Personal Markers Strip */}
                  {(data.obsession?.t_shirt || data.obsession?.birth_date) && (
                    <div className="bg-muted/10 border-t border-border/50 p-3 px-6 flex gap-3 flex-wrap items-center justify-center sm:justify-start">
                      {data.obsession.birth_date && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border-r border-border pr-3">
                          <Calendar className="h-3.5 w-3.5" />
                          Born {formatDate(data.obsession.birth_date)}
                        </div>
                      )}
                      {data.obsession.t_shirt && (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Shirt className="h-3.5 w-3.5 text-primary" />
                          Size {data.obsession.t_shirt}
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Sub Personal Details Card */}
                {data.obsession?.notes && (
                  <DataCard icon={FileText} title="Personal Notes">
                    <p className="text-sm wrap-break-word">{data.obsession.notes}</p>
                  </DataCard>
                )}

                {/* Contact & Location Card */}
                {hasContactCard && (
                <DataCard icon={Phone} title="Contact & Location">
                  {contacts.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</h4>
                       <div className="grid sm:grid-cols-2 gap-2">
                         {contacts.map((c, idx) => (
                           <div key={idx} className="flex flex-col gap-1 p-2.5 rounded-md border border-border/50 bg-background">
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-medium capitalize text-muted-foreground flex items-center gap-1.5">
                                  {c.contact_type === "email" ? <Mail className="w-3 h-3"/> : <Phone className="w-3 h-3"/>}
                                  {c.contact_type ?? "Contact"}
                                </span>
                                <Badge variant={c.is_primary ? "default" : "secondary"} className="text-[10px] px-1 py-0 h-4">
                                  {toPrimaryBadge(c.is_primary)}
                                </Badge>
                              </div>
                              <span className="text-sm font-medium select-text wrap-break-word">
                                {c.contact_value ?? "-"}
                              </span>
                              {c.contact_name && <span className="text-xs text-muted-foreground">{c.contact_name}</span>}
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                  {addresses.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Addresses</h4>
                       <div className="grid gap-2">
                         {addresses.map((a, idx) => (
                           <div key={idx} className="flex flex-col gap-1 p-2.5 rounded-md border border-border/50 bg-background">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3"/>
                                  {a.address_name || "Address"}
                                </span>
                                <Badge variant={a.is_primary ? "default" : "secondary"} className="text-[10px] px-1 py-0 h-4">
                                  {toPrimaryBadge(a.is_primary)}
                                </Badge>
                              </div>
                              <span className="text-sm select-text wrap-break-word">
                                {[a.address_1, a.address_2].filter(Boolean).join(", ")}
                              </span>
                              <span className="text-xs text-muted-foreground select-text wrap-break-word">
                                {[a.city, a.state, a.zip_code, a.country].filter(Boolean).join(", ")}
                              </span>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                </DataCard>
                )}

                {/* Employment Details Card */}
                {hasEmploymentCard && (
                <DataCard icon={Building2} title="Employment History">
                  {stores.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store Assignments</h4>
                       {stores.map((s, idx) => (
                         <div key={idx} className="flex justify-between items-center p-2 text-sm border-b border-border/50 last:border-0 pb-3">
                           <span className="font-medium select-text">{s.store?.store_number ?? `Store #${s.store_id}`}</span>
                           <span className="text-xs font-mono text-muted-foreground">{formatDate(s.effective_date)}</span>
                         </div>
                       ))}
                    </div>
                  )}

                  {statusHistories.length > 0 && (
                    <div className="space-y-2 mt-2 pt-4 border-t border-border/50">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Changes</h4>
                       {statusHistories.map((s, idx) => (
                         <div key={idx} className="flex justify-between items-start p-2 text-sm border-b border-border/50 last:border-0 pb-3">
                           <div className="flex flex-col gap-0.5">
                             <span className="font-medium capitalize">{s.status}</span>
                             {s.store && <span className="text-xs text-muted-foreground">Store {s.store.store_number}</span>}
                             {s.notes && <span className="text-xs text-muted-foreground italic">{s.notes}</span>}
                           </div>
                           <span className="text-xs font-mono text-muted-foreground">{formatDate(s.effective_date)}</span>
                         </div>
                       ))}
                    </div>
                  )}
                </DataCard>
                )}

                {/* Pay & Financial Card */}
                {hasPayCard && (
                <DataCard icon={Wallet} title="Pay & Financials">
                  {payHistories.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pay History</h4>
                       <div className="grid gap-2">
                         {payHistories.map((p, idx) => (
                           <div key={idx} className="flex justify-between items-center p-2.5 rounded-md border border-border/50 bg-muted/10">
                              <div className="flex gap-4">
                                <DetailItem label="Base Pay" value={`$${p.base_pay}`} />
                                <DetailItem label="Perf. Pay" value={`$${p.performance_pay}`} />
                              </div>
                              <div className="text-right">
                                <span className="block text-[10px] uppercase text-muted-foreground">Effective</span>
                                <span className="text-xs font-mono">{formatDate(p.effective_date)}</span>
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                  {financialInfos.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direct Deposit</h4>
                       <div className="grid gap-2">
                         {financialInfos.map((f, idx) => (
                           <div key={idx} className="p-3 rounded-md border border-border/50 bg-background space-y-2.5">
                              <div className="flex justify-between">
                                 <Badge variant="outline" className="text-[10px] capitalize">{f.account_type ?? "Account"}</Badge>
                                 <span className="text-xs font-mono text-muted-foreground">Eff. {formatDate(f.effective_date)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <DetailItem label="Routing Number" value={f.routing_number} />
                                 <DetailItem label="Account Number" value={f.account_number} />
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                </DataCard>
                )}

                {/* System IDs & Availability Card */}
                {hasIdsOrAvailability && (
                <div className="grid sm:grid-cols-2 gap-6">
                  {ids.length > 0 && (
                  <DataCard icon={IdCard} title="System IDs">
                      <div className="space-y-2">
                        {ids.map((eid, idx) => {
                          const typeName =
                            eid.id_type?.label ??
                            (eid.id_type_id != null
                              ? (idTypes.find((t) => t.id === eid.id_type_id)?.label ??
                                `ID Type #${eid.id_type_id}`)
                              : "ID");
                          return (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                               <span className="text-xs font-medium text-muted-foreground">{typeName}</span>
                               <span className="text-sm font-mono select-text">{eid.id_value ?? "-"}</span>
                            </div>
                          );
                        })}
                      </div>
                  </DataCard>
                  )}

                  {availabilityDays.length > 0 && (
                  <DataCard icon={Clock} title="Availability">
                      <div className="space-y-2">
                        {availabilityDays.map((av, idx) => {
                          const times = av.times ?? [];
                          return (
                           <div key={idx} className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
                              <div className="flex flex-col gap-0.5">
                                 <span className="text-sm font-medium capitalize">{av.day_of_week}</span>
                                 {av.shift_type && <span className="text-[10px] text-muted-foreground uppercase">{av.shift_type}</span>}
                              </div>
                              <div className="text-right">
                                {times.length > 0 ? (
                                  times.map((t, ti) => (
                                    <span key={ti} className="block text-xs font-mono">
                                      {t.available_from} - {t.available_to}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Unavailable</span>
                                )}
                              </div>
                           </div>
                          );
                        })}
                      </div>
                  </DataCard>
                  )}
                </div>
                )}

                {/* Attachments Card */}
                {attachments.length > 0 && (
                  <DataCard icon={Paperclip} title="Attachments">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {attachments.map((att, idx) => {
                        const typeName =
                          att.attachment_type?.label ??
                          (att.type_id != null
                            ? (attachmentTypes.find((t) => t.id === att.type_id)?.label ??
                              `Type #${att.type_id}`)
                            : "Document");
                        const fileUrl = att.attachment_url ?? null;
                        const sizeLabel = formatFileSize(att.file_size);
                        return (
                          <a
                            key={idx}
                            href={fileUrl ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-col gap-1 p-3 rounded-md border border-border/50 bg-background hover:bg-muted/50 transition-colors group"
                            onClick={(e) => { if (!fileUrl) e.preventDefault(); }}
                          >
                            <div className="flex justify-between">
                              <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                {typeName}
                              </span>
                              {sizeLabel && <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>}
                            </div>
                            {att.original_name && <span className="text-xs text-muted-foreground truncate">{att.original_name}</span>}
                            {att.notes && <span className="text-[10px] text-muted-foreground italic mt-1">{att.notes}</span>}
                          </a>
                        );
                      })}
                    </div>
                  </DataCard>
                )}
              </>
            )}
            
            {/* Bottom spacer to ensure scrolling breathes */}
            <div className="h-4" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}