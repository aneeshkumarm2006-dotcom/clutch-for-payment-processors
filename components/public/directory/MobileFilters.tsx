"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilterRail } from "@/components/public/directory/FilterRail";
import { useFilters } from "@/components/public/directory/use-filters";

/**
 * Mobile filter trigger + bottom Sheet (DESIGN §4 — rail collapses to a bottom
 * Sheet under `lg`). Hidden on `lg+` where the rail is always visible.
 */
export function MobileFilters() {
  const [open, setOpen] = React.useState(false);
  const { params } = useFilters();

  const count =
    params.pricingModel.length +
    params.methods.length +
    params.integrations.length +
    params.features.length +
    params.region.length +
    params.size.length +
    params.rate.length +
    params.fee.length +
    (params.q ? 1 : 0) +
    (params.minRating !== undefined ? 1 : 0) +
    (params.verifiedOnly ? 1 : 0) +
    (params.highRisk ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className="lg:hidden">
          <SlidersHorizontal className="size-4" />
          Filters
          {count > 0 && (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-micro text-accent-foreground tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">Filters</SheetTitle>
        </SheetHeader>
        <FilterRail />
        <div className="sticky bottom-0 mt-6 -mx-6 border-t bg-card px-6 py-3">
          <Button variant="primary" className="w-full" onClick={() => setOpen(false)}>
            Show results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileFilters;
