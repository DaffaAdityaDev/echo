import * as React from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    const variants = {
      primary:
        "bg-gradient-to-b from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground border border-primary/50 shadow-xs",
      secondary: "bg-elevated text-foreground hover:bg-surface-hover border border-border shadow-xs",
      ghost: "bg-transparent text-muted hover:bg-surface-hover hover:text-foreground",
      danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-background shadow-xs",
      outline:
        "border border-border bg-elevated text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent",
    };

    const sizes = {
      sm: "h-7 px-3 text-2xs gap-1.5 rounded-sm",
      md: "h-9 px-4 text-2xs gap-2 rounded-sm",
      lg: "h-11 px-5 text-xs gap-2.5 rounded-sm",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-mono font-semibold tracking-tech-mono uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
        disabled={isLoading || props.disabled}
        aria-busy={isLoading || undefined}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0"
          />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
