"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreateEmployeeDebriefForm } from "@/components/employee-debriefs/create-employee-debrief-form";
import { useCreateEmployeeDebrief } from "@/lib/hooks/use-employee-debriefs";
import { cn } from "@/lib/utils";

interface StoreOption {
  id: string;
  name: string;
}

function parseAuthUserStores(): StoreOption[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("auth-user");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      stores?: Array<{
        store?: {
          id?: string | number;
          store_id?: string | number;
          name?: string;
        };
      }>;
    };

    return (parsed.stores ?? [])
      .map((entry) => {
        const store = entry.store;
        const resolvedId = String(store?.store_id ?? store?.id ?? "").trim();
        const resolvedName = store?.name?.trim() || resolvedId;
        return { id: resolvedId, name: resolvedName };
      })
      .filter((s) => s.id.length > 0);
  } catch {
    return [];
  }
}

export function FloatingDebriefButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const {
    createDebrief,
    isSubmitting,
    error: createError,
    clearError: clearCreateError,
  } = useCreateEmployeeDebrief();

  useEffect(() => {
    const parsed = parseAuthUserStores();
    setStores(parsed);
    if (parsed.length > 0) {
      setSelectedStoreId(parsed[0].id);
    }
  }, []);

  return (
    <>
      {/* Backdrop — closes the panel on click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-20 right-6 z-50 w-80 max-h-[68vh]",
            "overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
            "dark:scrollbar-thumb-gray-600",
            "rounded-2xl bg-background shadow-2xl",
            "border border-gray-200/60 dark:border-gray-700/60",
          )}
        >
          {/* Panel header with gradient background */}
          <div className="sticky top-0 z-10 bg-background px-4 pt-4 pb-3 border-b border-gray-100/60 dark:border-gray-800/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Write a Debrief Note</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Quick notes for your records</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Store picker with improved styling */}
          <div className="px-4 py-3 border-b border-gray-100/40 dark:border-gray-800/40">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Store</Label>
            <Select
              value={selectedStoreId ?? ""}
              onValueChange={(v) => setSelectedStoreId(v || null)}
              disabled={stores.length === 0}
            >
              <SelectTrigger className="h-8 text-xs mt-1.5 border-gray-200/60 dark:border-gray-700/60">
                <SelectValue
                  placeholder={stores.length === 0 ? "No stores found" : "Select store"}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                style={{ maxHeight: "160px", overflowY: "auto" }}
                className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              >
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Debrief form */}
          <div className="px-4 py-3">
            <CreateEmployeeDebriefForm
              storeId={selectedStoreId}
              isSubmitting={isSubmitting}
              submitError={createError}
              onClearError={clearCreateError}
              onSubmit={async (payload) => {
                if (!selectedStoreId) return false;
                const success = await createDebrief(selectedStoreId, payload);
                if (success) {
                  toast.success("Debrief submitted successfully.");
                }
                return success;
              }}
            />
          </div>
        </div>
      )}

      {/* FAB button with improved styling */}
      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-6 right-6 z-50 gap-2 rounded-full",
          "h-11 px-5 text-sm font-medium shadow-lg hover:shadow-xl",
          "transition-all duration-200 ease-out",
          "border",
          isOpen
            ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700"
            : "bg-white text-black border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-100 dark:bg-white-700 dark:border-white-600 dark:hover:bg-white-600",
        )}
        size="sm"
      >
        <PenLine className="h-4 w-4" />
        <span>Debrief</span>
      </Button>
    </>
  );
}
