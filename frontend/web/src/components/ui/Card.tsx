import * as React from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  withCrosshairs?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, withCrosshairs = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xs border border-border bg-white text-foreground shadow-xs font-mono relative",
        withCrosshairs && "crosshair-container",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 border-b border-border", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-base font-bold tracking-tight text-foreground font-mono", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 font-mono text-sm text-muted", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export { Card, CardContent, CardHeader, CardTitle };
