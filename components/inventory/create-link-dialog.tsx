"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Copy, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MultiSelect } from "@/components/daily-pay/multi-select";
import { InventoryStoreSelect } from "@/components/inventory/inventory-store-select";
import { toast } from "sonner";
import { useCreateLinks } from "@/lib/hooks/use-inventory-links";
import { useInventoryEmployees } from "@/lib/hooks/use-inventory-employees";
import { useInventoryStores } from "@/lib/hooks/use-inventory-stores";
import { publicCountUrl } from "@/lib/inventory/public-link-url";
import type { InventoryType } from "@/types/inventory.types";

const TYPES: InventoryType[] = ["daily", "weekly", "period"];

/** Shorten a token for display (e.g. "Wo6s8BRY…6TKfCD") — never needs to scroll. */
function shortToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}…${token.slice(-6)}`;
}

/**
 * Dialog to create inventory links (one per selected employee) for a store.
 * The store is picked inside the dialog itself (defaulting to whichever store
 * the page was showing), so generating links never depends on page-level state.
 * Employees come from the Hiring metrics endpoint; raw IDs can also be typed in
 * case someone isn't listed. After creation, the resulting public URLs are shown
 * with copy buttons.
 */
export function CreateLinkDialog({
  open,
  onOpenChange,
  initialStoreId = "",
  onLinksCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Store to preselect when the dialog opens (e.g. the page's current filter). */
  initialStoreId?: string;
  /** Called with the store_id once links are generated, so the caller can sync its view. */
  onLinksCreated?: (storeId: string) => void;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const {
    createLinks,
    isCreating,
    createError,
    createdLinks,
    clearCreated,
    clearErrors,
  } = useCreateLinks();

  const { stores } = useInventoryStores();
  const storeOptions = stores.map((s) => ({ storeId: s.storeId ?? s.id, name: s.name }));

  const [storeId, setStoreId] = useState(initialStoreId);
  // today's date as the default (YYYY-MM-DD).
  const [date, setDate] = useState("");
  const [type, setType] = useState<InventoryType>("daily");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [manualIds, setManualIds] = useState("");

  // Employees are looked up by store number; re-fetched whenever the picked store changes.
  const { options, isLoading, error: empError } = useInventoryEmployees(
    open ? storeId : null
  );

  useEffect(() => {
    if (open) {
      // Reset form each time the dialog opens.
      setStoreId(initialStoreId);
      setSelectedEmployees([]);
      setManualIds("");
      setType("daily");
      setDate(new Date().toISOString().slice(0, 10));
      clearCreated();
      clearErrors();
    }
  }, [open, initialStoreId, clearCreated, clearErrors]);

  // Switching stores invalidates any picked employees (they belong to the old store).
  const handleStoreChange = (next: string) => {
    setStoreId(next);
    setSelectedEmployees([]);
    setManualIds("");
  };

  // Merge multi-select picks with any manually typed IDs (comma/space separated).
  const employeeIds = useMemo(() => {
    const manual = manualIds
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    return Array.from(new Set([...selectedEmployees, ...manual]));
  }, [selectedEmployees, manualIds]);

  const canSubmit = Boolean(storeId) && Boolean(date) && employeeIds.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const links = await createLinks({
        store_id: storeId,
        date,
        type,
        employee_ids: employeeIds,
      });
      toast.success(`Created ${links.length} link(s).`);
      onLinksCreated?.(storeId);
    } catch {
      // createError is shown inline below.
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Link copied.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate links</DialogTitle>
          <DialogDescription>
            Creates one single-use submission link per employee. Items are
            auto-selected by the server from the store &amp; type.
          </DialogDescription>
        </DialogHeader>

        {/* Result view (after creation) */}
        {createdLinks.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-sm">
                <span className="font-medium">{createdLinks.length}</span>{" "}
                link{createdLinks.length === 1 ? "" : "s"} created
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copy(
                    createdLinks
                      .map((l) => publicCountUrl(locale, l.token))
                      .join("\n")
                  )
                }
              >
                <Copy className="me-1.5 h-3.5 w-3.5" />
                Copy all
              </Button>
            </div>

            {/* Each row is a fixed, single-line layout — the token is shortened
                so it never needs horizontal scroll regardless of dialog width. */}
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {createdLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {link.employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {link.employee.name}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        …/count/{shortToken(link.token)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => copy(publicCountUrl(locale, link.token))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          // Form view
          <form onSubmit={handleSubmit} className="space-y-4">
            {(createError || empError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{createError || empError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>
                Store <span className="text-destructive">*</span>
              </Label>
              <InventoryStoreSelect
                stores={storeOptions}
                value={storeId}
                onChange={handleStoreChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="link-date">
                  Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker value={date} onChange={setDate} />
              </div>
              <div className="space-y-2">
                <Label>
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as InventoryType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Employees <span className="text-destructive">*</span>
              </Label>
              <MultiSelect
                options={options}
                selected={selectedEmployees}
                onChange={setSelectedEmployees}
                placeholder={
                  !storeId
                    ? "Pick a store first…"
                    : isLoading
                    ? "Loading employees…"
                    : "Select employees…"
                }
                icon={<Users className="h-3.5 w-3.5" />}
                disabled={!storeId || isLoading}
                searchPlaceholder="Search employees…"
                emptyText="No employees found for this store."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-ids">Or enter employee IDs manually</Label>
              <Input
                id="manual-ids"
                value={manualIds}
                onChange={(e) => setManualIds(e.target.value)}
                placeholder="e.g. 6, 7, 12"
              />
              <p className="text-xs text-muted-foreground">
                Comma or space separated. Useful if an employee isn’t in the list.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              {employeeIds.length} employee(s) selected.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || isCreating}>
                {isCreating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
