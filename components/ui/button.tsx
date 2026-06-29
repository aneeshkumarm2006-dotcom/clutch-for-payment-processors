import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Variants follow DESIGN §6.1 — default action color is ink, not violet.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-ink-800 dark:hover:bg-ink-200",
        secondary:
          "border border-border-strong bg-transparent text-ink-900 hover:bg-ink-100 dark:text-ink-50 dark:hover:bg-ink-800",
        accent: "bg-accent text-accent-foreground hover:bg-violet-700",
        ghost: "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
        link: "text-accent underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline:
          "border border-border-strong bg-transparent hover:bg-ink-100 dark:hover:bg-ink-800",
      },
      size: {
        sm: "h-8 px-3 text-small",
        md: "h-10 px-5 text-[0.875rem]",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
