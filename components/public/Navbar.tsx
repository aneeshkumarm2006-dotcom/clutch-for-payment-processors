"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SearchBox } from "@/components/public/SearchBox";
import { MegaMenu } from "@/components/public/MegaMenu";
import type { CategoryData } from "@/lib/serialize";

/**
 * Public navbar (DESIGN §6.6). Wordmark (one violet accent), categories
 * mega-menu, inline search, and CTAs on desktop; a right-side Sheet on mobile.
 */
const NAV_LINKS = [
  { label: "Processors", href: "/processors" },
  { label: "Compare", href: "/compare" },
  { label: "Methodology", href: "/methodology" },
  { label: "Blog", href: "/blog" },
];

export function Navbar({ categories }: { categories: CategoryData[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 lg:px-6">
        {/* Wordmark */}
        <Link href="/" className="shrink-0 text-h4 tracking-tighter2 text-foreground">
          PayCompare<span className="text-accent">.</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 md:flex">
          <MegaMenu categories={categories} />
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-small text-ink-700 transition-colors hover:text-foreground dark:text-ink-300"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Desktop search + CTAs */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <SearchBox className="w-64" placeholder="Search processors…" />
          <Button asChild variant="accent">
            <Link href="/write-review">Write a review</Link>
          </Button>
        </div>

        {/* Tablet CTA (no inline search) */}
        <div className="ml-auto hidden items-center gap-2 md:flex lg:hidden">
          <Button asChild variant="accent">
            <Link href="/write-review">Write a review</Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-full flex-col gap-6 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">
                  PayCompare<span className="text-accent">.</span>
                </SheetTitle>
              </SheetHeader>

              <SearchBox />

              <nav className="flex flex-col gap-1">
                {[{ label: "All processors", href: "/processors" }, ...NAV_LINKS.filter((l) => l.href !== "/processors")].map(
                  (l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="rounded px-2 py-2 text-body text-ink-800 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
                    >
                      {l.label}
                    </Link>
                  ),
                )}
              </nav>

              {categories.length > 0 && (
                <div>
                  <p className="px-2 text-label uppercase text-ink-500">Categories</p>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {categories.slice(0, 8).map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={`/category/${c.slug}`}
                          onClick={() => setOpen(false)}
                          className="block rounded px-2 py-1.5 text-small text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2">
                <Button asChild variant="accent" onClick={() => setOpen(false)}>
                  <Link href="/write-review">Write a review</Link>
                </Button>
                <Button asChild variant="secondary" onClick={() => setOpen(false)}>
                  <Link href="/for-processors">List your processor</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
