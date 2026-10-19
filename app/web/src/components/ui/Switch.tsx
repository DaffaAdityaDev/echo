"use client";

import { cn } from "@/utils/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

const TRACK_SIZE = { sm: "w-8 h-4", md: "w-9 h-5" } as const;
const THUMB_SIZE = { sm: "w-3 h-3", md: "w-4 h-4" } as const;

export function Switch({ checked, onChange, label, size = "md", disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        TRACK_SIZE[size],
        checked ? "bg-primary" : "bg-subtle",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-primary-foreground shadow-sm transition-transform",
          THUMB_SIZE[size],
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
