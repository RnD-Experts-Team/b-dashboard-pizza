"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { StorePassportDialog } from "./store-passport-dialog";

/**
 * Topbar trigger for the store passport, sized to match the other icon
 * buttons in the cluster. Hides itself when no store is selected — the
 * passport would have nothing to describe.
 */
export function StorePassportButton() {
  const t = useTranslations("storePassport");
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const [open, setOpen] = useState(false);

  if (!selectedStore) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            // data-guide-id: PageGuide spotlight target, matching the other
            // topbar widgets.
            data-guide-id="topbar-store-passport"
            variant="ghost"
            size="icon"
            aria-label={t("trigger")}
            onClick={() => setOpen(true)}
          >
            <StoreIcon className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("trigger")}</TooltipContent>
      </Tooltip>

      <StorePassportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
