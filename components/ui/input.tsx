import * as React from "react";

import { cn } from "@/lib/utils";

// DESIGN §6.5 — h-40px, sunken bg, 1px border, violet focus ring.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded border border-input bg-muted px-3 py-2 text-[0.875rem] text-foreground transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
