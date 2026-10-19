"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ToastProps {
  show: boolean;
  message: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const ICON_TONES = {
  success: "text-success",
  error: "text-danger",
  info: "text-accent",
} as const;

// The live region stays mounted so assistive tech announces each message
// when it is inserted, not only the first one.
export function Toast({ show, message, type = "success", onClose }: ToastProps) {
  const Icon = ICONS[type];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2.5rem)]"
    >
      {show && (
        <div className="flex items-center gap-3 pl-4 pr-2 py-3 rounded-md border border-border bg-elevated text-foreground shadow-xl text-xs font-medium animate-in slide-in-from-bottom-2">
          <Icon className={cn("h-4 w-4 shrink-0", ICON_TONES[type])} aria-hidden="true" />
          <span className="min-w-0 break-words">{message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss notification"
              className="ml-1 p-1 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
