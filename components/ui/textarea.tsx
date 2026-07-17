import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-28 w-full resize-y rounded border border-input bg-muted px-3 py-2 text-[0.875rem] text-foreground transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
