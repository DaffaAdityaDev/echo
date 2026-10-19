"use client";

import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/utils/cn";
import { useChatStore } from "../stores/chatStore";

const NOTICE_TTL_MS = 8000;

const LEVEL_STYLES = {
  info: "border-accent/40 text-accent",
  warning: "border-warning/40 text-warning",
  error: "border-danger/40 text-danger",
} as const;

function getNoticeStyle(level: string): string {
  if (level === "warning") return LEVEL_STYLES.warning;

  if (level === "error") return LEVEL_STYLES.error;

  return LEVEL_STYLES.info;
}

function getNoticeIcon(level: string) {
  if (level === "warning") return AlertTriangle;

  if (level === "error") return AlertCircle;

  return Info;
}

export function SystemNoticeToast() {
  const notices = useChatStore((s) => s.systemNotices);
  const dismiss = useChatStore((s) => s.dismissSystemNotice);

  useEffect(() => {
    const now = Date.now();
    const timers = notices.map((notice) =>
      setTimeout(() => dismiss(notice.id), Math.max(0, notice.timestamp + NOTICE_TTL_MS - now)),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [notices, dismiss]);

  const visible = notices.slice(-3);

  // The live region stays mounted so newly inserted notices are announced.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="System notices"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:max-w-sm"
    >
      {visible.map((notice) => {
        const Icon = getNoticeIcon(notice.level);

        return (
          <div
            key={notice.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-md border bg-elevated shadow-xl animate-in slide-in-from-right",
              getNoticeStyle(notice.level),
            )}
          >
            <Icon size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-bold uppercase tracking-wider break-words">{notice.code}</p>
              <p className="text-xs text-foreground mt-0.5 break-words">{notice.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(notice.id)}
              aria-label={`Dismiss ${notice.code} notice`}
              className="p-1 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
