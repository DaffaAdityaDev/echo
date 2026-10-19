"use client";

import { AlertTriangle, MessageSquareOff, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SKELETON_ROWS = ["w-2/3", "w-5/6", "w-1/2"] as const;

export function MessagesLoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex-1 overflow-hidden px-4 py-8">
      <span className="sr-only">Loading conversation…</span>
      <div aria-hidden="true" className="max-w-5xl mx-auto space-y-8 animate-pulse">
        {SKELETON_ROWS.map((width, idx) => (
          <div key={width} className={idx % 2 === 0 ? "flex gap-4" : "flex flex-row-reverse gap-4"}>
            <div className="w-8 h-8 rounded-sm bg-surface-hover border border-border shrink-0" />
            <div className={`${width} space-y-2 rounded-md border border-border bg-elevated p-4`}>
              <div className="h-3 w-3/4 rounded-sm bg-surface-hover" />
              <div className="h-3 w-full rounded-sm bg-surface-hover" />
              <div className="h-3 w-1/2 rounded-sm bg-surface-hover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SessionUnavailableStateProps {
  onCreateSession: () => void;
}

export function SessionUnavailableState({ onCreateSession }: SessionUnavailableStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="p-3 rounded-md bg-surface-hover border border-border text-muted">
        <MessageSquareOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-foreground">Conversation not found</h2>
        <p className="text-sm text-muted max-w-sm">This session does not exist or you no longer have access to it.</p>
      </div>
      <Button type="button" onClick={onCreateSession}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>New chat</span>
      </Button>
    </div>
  );
}

interface MessagesErrorStateProps {
  onRetry: () => void;
}

export function MessagesErrorState({ onRetry }: MessagesErrorStateProps) {
  return (
    <div role="alert" className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
      <p className="text-sm text-muted">Failed to load messages</p>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCcw className="h-3 w-3" aria-hidden="true" />
        <span>Retry</span>
      </Button>
    </div>
  );
}

export function MessagesRefreshErrorBanner({ onRetry }: MessagesErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 px-4 py-1.5 bg-danger/5 border-b border-danger/20"
    >
      <p className="text-xs text-danger">Failed to refresh messages</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-semibold text-danger hover:underline cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}
