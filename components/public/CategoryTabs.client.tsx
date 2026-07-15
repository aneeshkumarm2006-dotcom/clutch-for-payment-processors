"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const GUIDE_VALUE = "buyers-guide";
const PRODUCTS_VALUE = "products";

/**
 * "All products | Buyers guide" tab switch (Capterra-style).
 *
 * BOTH panels are server-rendered and kept in the DOM (`forceMount`) so crawlers
 * see the guide even when the products tab is active — the tab only flips
 * visibility. Tab state lives in the URL *hash* (`#buyers-guide`), never a query
 * param, so the canonical URL is untouched and no near-duplicate indexable URLs are
 * created. Deep-linking to a guide section (`#some-heading`) also lands on the guide
 * tab.
 */
export function CategoryTabs({
  productsLabel,
  guideLabel,
  products,
  guide,
}: {
  productsLabel: string;
  guideLabel: string;
  products: React.ReactNode;
  guide: React.ReactNode;
}) {
  const [value, setValue] = React.useState(PRODUCTS_VALUE);

  // Land on the guide tab when the URL points at it (the tab itself, or any
  // in-guide section anchor other than the bare products view).
  React.useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && hash !== PRODUCTS_VALUE) setValue(GUIDE_VALUE);
  }, []);

  const onValueChange = (next: string) => {
    setValue(next);
    const hash = next === GUIDE_VALUE ? `#${GUIDE_VALUE}` : "";
    // replaceState keeps this out of the history stack and avoids the scroll-jump a
    // real hash navigation would trigger.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  };

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value={PRODUCTS_VALUE}>{productsLabel}</TabsTrigger>
        <TabsTrigger value={GUIDE_VALUE}>{guideLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value={PRODUCTS_VALUE} forceMount className="data-[state=inactive]:hidden">
        {products}
      </TabsContent>
      <TabsContent value={GUIDE_VALUE} forceMount className="data-[state=inactive]:hidden">
        {guide}
      </TabsContent>
    </Tabs>
  );
}

export default CategoryTabs;
