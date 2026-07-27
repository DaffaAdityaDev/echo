import * as React from "react"
import { cn } from "@/utils/cn"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xs border border-border bg-white px-3 py-2 text-xs font-mono text-foreground placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gb-blue focus-visible:border-gb-blue disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-xs",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

