"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBottomNavStore } from "@/lib/store/bottom-nav.store";
import { MAX_BOTTOM_NAV_ITEMS } from "@/lib/nav/bottom-nav-access";
import { BOTTOM_NAV_GROUPS, type BottomNavItem } from "@/lib/nav/bottom-nav-items";
import { cn } from "@/lib/utils";

interface BottomNavEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleItems: BottomNavItem[];
  defaultItemIds: string[];
}

/** One flat (ungrouped) item, or a contiguous run of items sharing a groupKey —
 * mirrors sidebar.tsx's mix of standalone links and collapsible NavGroups. */
type Section =
  | { type: "flat"; item: BottomNavItem }
  | { type: "group"; groupKey: string; items: BottomNavItem[] };

function buildSections(items: BottomNavItem[]): Section[] {
  const sections: Section[] = [];
  for (const item of items) {
    if (!item.groupKey) {
      sections.push({ type: "flat", item });
      continue;
    }
    const last = sections[sections.length - 1];
    if (last?.type === "group" && last.groupKey === item.groupKey) {
      last.items.push(item);
    } else {
      sections.push({ type: "group", groupKey: item.groupKey, items: [item] });
    }
  }
  return sections;
}

export function BottomNavEditSheet({
  open,
  onOpenChange,
  eligibleItems,
  defaultItemIds,
}: BottomNavEditSheetProps) {
  const t = useTranslations("bottomNav");
  const tNav = useTranslations("nav");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(BOTTOM_NAV_GROUPS).map((key) => [key, true]))
  );

  const sections = useMemo(() => buildSections(eligibleItems), [eligibleItems]);

  const rawSelectedItemIds = useBottomNavStore((s) => s.selectedItemIds) ?? [];
  const editBackup = useBottomNavStore((s) => s.editBackup) ?? [];
  const toggleItemInEdit = useBottomNavStore((s) => s.toggleItemInEdit);
  const exitEditMode = useBottomNavStore((s) => s.exitEditMode);
  const resetDraftToDefaults = useBottomNavStore((s) => s.resetDraftToDefaults);

  // Defense in depth: only ever count/check ids that are actually eligible
  // for this user right now. A stale id (leftover from another identity, or
  // from a permission that changed mid-session) must never inflate the
  // selected count against rows that don't even render, which would lock
  // every visible checkbox as "at the cap" while showing fewer checks.
  const selectedItemIds = rawSelectedItemIds.filter((id) =>
    eligibleItems.some((item) => item.id === id)
  );

  const count = selectedItemIds.length;
  const isDirty =
    JSON.stringify([...selectedItemIds].sort()) !== JSON.stringify([...editBackup].sort());

  const handleSave = () => {
    exitEditMode(true);
    onOpenChange(false);
    toast.success(t("saved"));
  };

  const handleDiscard = () => {
    exitEditMode(false);
    onOpenChange(false);
  };

  const handleCancelClick = () => {
    if (!isDirty) {
      handleDiscard();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleCancelClick()}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{t("editTitle")}</SheetTitle>
          <SheetDescription>
            {t("editDescription", { max: MAX_BOTTOM_NAV_ITEMS })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground tabular-nums">
            {t("selectedCount", { count, max: MAX_BOTTOM_NAV_ITEMS })}
          </p>
          <div className="space-y-1">
            {sections.map((section) => {
              if (section.type === "flat") {
                return (
                  <ItemRow
                    key={section.item.id}
                    item={section.item}
                    isChecked={selectedItemIds.includes(section.item.id)}
                    isDisabled={
                      !selectedItemIds.includes(section.item.id) &&
                      count >= MAX_BOTTOM_NAV_ITEMS
                    }
                    onToggle={toggleItemInEdit}
                    label={tNav(section.item.titleKey)}
                  />
                );
              }

              const group = BOTTOM_NAV_GROUPS[section.groupKey];
              const isOpen = openGroups[section.groupKey] ?? true;
              return (
                <Collapsible
                  key={section.groupKey}
                  open={isOpen}
                  onOpenChange={(next) =>
                    setOpenGroups((prev) => ({ ...prev, [section.groupKey]: next }))
                  }
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {group && <group.icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate">
                        {group ? tNav(group.labelKey) : section.groupKey}
                      </span>
                      <ChevronDown
                        className={cn(
                          "ms-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <div className="ms-4 space-y-1 border-s ps-2">
                      {section.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          isChecked={selectedItemIds.includes(item.id)}
                          isDisabled={
                            !selectedItemIds.includes(item.id) &&
                            count >= MAX_BOTTOM_NAV_ITEMS
                          }
                          onToggle={toggleItemInEdit}
                          label={tNav(item.titleKey)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        <SheetFooter className="flex-row justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t("reset")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("resetConfirm.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("resetConfirm.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetDraftToDefaults(defaultItemIds)}>
                  {t("reset")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-2">
            {isDirty ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {t("cancel")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("discardChanges.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("discardChanges.description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("save")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDiscard}>
                      {t("cancel")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleDiscard}>
                {t("cancel")}
              </Button>
            )}
            <Button size="sm" onClick={handleSave}>
              {t("save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ItemRow({
  item,
  label,
  isChecked,
  isDisabled,
  onToggle,
}: {
  item: BottomNavItem;
  label: string;
  isChecked: boolean;
  isDisabled: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 text-sm",
        isDisabled ? "opacity-50" : "hover:bg-accent"
      )}
    >
      <Checkbox
        checked={isChecked}
        disabled={isDisabled}
        onCheckedChange={() => onToggle(item.id)}
      />
      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </label>
  );
}
