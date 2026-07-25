import * as React from "react"
import { cn } from "@/utils/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'verified' | 'success' | 'blocked' | 'parameter' | 'warning' | 'danger'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/60',
    outline: 'border border-zinc-700/80 text-zinc-400 bg-transparent',
    verified: 'bg--success/10 text--success border border--success/30',
    success: 'bg--success/10 text--success border border--success/30',
    blocked: 'bg--status-blocked/10 text--status-blocked border border--status-blocked/30',
    parameter: 'bg--status-parameter/10 text--status-parameter border border--status-parameter/30',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
  }


  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-[0.10em] transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }

