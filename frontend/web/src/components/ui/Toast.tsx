"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ToastProps {
  show: boolean;
  message: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}

export function Toast({ show, message, type = "success", onClose }: ToastProps) {
  if (!show) return null;

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />,
    info: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
  };

  const borders = {
    success: "border-emerald-500/30 bg-emerald-950/80 text-emerald-100",
    error: "border-red-500/30 bg-red-950/80 text-red-100",
    info: "border-blue-500/30 bg-blue-950/80 text-blue-100",
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-medium transition-all duration-300 animate-in slide-in-from-bottom-2",
        borders[type]
      )}
    >
      {icons[type]}
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-md text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
