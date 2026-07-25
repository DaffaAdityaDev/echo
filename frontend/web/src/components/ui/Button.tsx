import * as React from "react"
import { cn } from "@/utils/cn"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-b from--gb-bright-blue to--gb-blue hover:from--gb-dark-blue hover:to--gb-dark-blue text-white border border--gb-blue/50 shadow-xs',
      secondary: 'bg-white text--foreground hover:bg--surface border border--border shadow-xs',
      ghost: 'bg-transparent text--muted hover:bg--surface hover:text--foreground',
      danger: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white shadow-xs',
      outline: 'border border--border bg-white text--foreground hover:border--gb-bright-blue hover:bg--blue-50 hover:text--gb-blue',
    }


    const sizes = {
      sm: 'h-7 px-3 text-[10px] gap-1.5 rounded-xs',
      md: 'h-9 px-4 text-[11px] gap-2 rounded-xs',
      lg: 'h-11 px-5 text-xs gap-2.5 rounded-xs',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-mono font-semibold tracking-[0.06em] uppercase transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }

