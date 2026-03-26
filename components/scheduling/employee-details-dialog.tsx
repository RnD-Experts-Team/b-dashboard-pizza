"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ScheduleEmployee, Shift } from "@/types/scheduling.types";
import { DAYS_OF_WEEK, formatTime } from "@/lib/scheduling/data";

/** Mock extra details keyed by employee id */
const MOCK_DETAILS: Record<
  string,
  { phone: string; email: string; hireDate: string; address: string; emergencyContact: string }
> = {
  "emp-1": { phone: "+1 (555) 234-5678", email: "marco.rossi@pizza.co", hireDate: "Jan 15, 2022", address: "123 Main St, Downtown", emergencyContact: "Anna Rossi — +1 (555) 111-2222" },
  "emp-2": { phone: "+1 (555) 345-6789", email: "sofia.kim@pizza.co", hireDate: "Mar 08, 2023", address: "456 Oak Ave, Apt 2B", emergencyContact: "Jun Kim — +1 (555) 222-3333" },
  "emp-3": { phone: "+1 (555) 456-7890", email: "leo.jenkins@pizza.co", hireDate: "Nov 22, 2021", address: "789 Elm Blvd, Suite 5", emergencyContact: "Pat Jenkins — +1 (555) 333-4444" },
  "emp-4": { phone: "+1 (555) 567-8901", email: "elena.patel@pizza.co", hireDate: "Jun 01, 2023", address: "321 Pine Rd", emergencyContact: "Ravi Patel — +1 (555) 444-5555" },
  "emp-5": { phone: "+1 (555) 678-9012", email: "david.chen@pizza.co", hireDate: "Sep 10, 2024", address: "654 Maple Dr", emergencyContact: "Wei Chen — +1 (555) 555-6666" },
  "emp-6": { phone: "+1 (555) 789-0123", email: "maria.rodriguez@pizza.co", hireDate: "Feb 14, 2022", address: "987 Cedar Ln", emergencyContact: "Carlos Rodriguez — +1 (555) 666-7777" },
  "emp-7": { phone: "+1 (555) 890-1234", email: "james.carter@pizza.co", hireDate: "Aug 20, 2020", address: "135 Birch Way", emergencyContact: "Lisa Carter — +1 (555) 777-8888" },
  "emp-8": { phone: "+1 (555) 901-2345", email: "aisha.noor@pizza.co", hireDate: "Apr 05, 2024", address: "246 Walnut St", emergencyContact: "Fatima Noor — +1 (555) 888-9999" },
};

const FALLBACK_DETAIL = {
  phone: "+1 (555) 000-0000",
  email: "employee@pizza.co",
  hireDate: "Jan 01, 2023",
  address: "N/A",
  emergencyContact: "N/A",
};

interface EmployeeDetailsDialogProps {
  employee: ScheduleEmployee | null;
  shifts: Shift[];
  hours: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailsDialog({
  employee,
  shifts,
  hours,
  open,
  onOpenChange,
}: EmployeeDetailsDialogProps) {
  if (!employee) return null;

  const detail = MOCK_DETAILS[employee.id] ?? FALLBACK_DETAIL;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
          <DialogDescription>
            View information and schedule for this employee.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {employee.avatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">
              {employee.department}
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Station
            </p>
            <Badge variant="secondary" className="mt-1">
              {employee.role}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Weekly Hours
            </p>
            <p className="mt-1 text-lg font-semibold">
              {hours.toFixed(1)}h
            </p>
          </div>
        </div>

        <Separator />

        {/* Extra mock details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Phone
            </p>
            <p className="mt-0.5">{detail.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email
            </p>
            <p className="mt-0.5 truncate">{detail.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hire Date
            </p>
            <p className="mt-0.5">{detail.hireDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Address
            </p>
            <p className="mt-0.5 truncate">{detail.address}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency Contact
            </p>
            <p className="mt-0.5">{detail.emergencyContact}</p>
          </div>
        </div>

        {shifts.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Scheduled Shifts
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {DAYS_OF_WEEK[s.dayIndex]}
                    </span>
                    <span className="text-muted-foreground">
                      {formatTime(s.startTime)} - {formatTime(s.endTime)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {shifts.length === 0 && (
          <>
            <Separator />
            <p className="py-2 text-sm text-muted-foreground text-center">
              No shifts scheduled this week.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
