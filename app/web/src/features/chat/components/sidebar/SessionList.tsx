"use client";

import type { RefObject } from "react";
import type { Session } from "../../types";
import { SessionListItem } from "./SessionListItem";

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  isInitialLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  searchTerm?: string;
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  loadMoreRef,
  isFetchingNextPage,
  isInitialLoading = false,
  isError = false,
  onRetry,
  searchTerm = "",
}: SessionListProps) {
  // Group sessions by recency
  const now = new Date();

  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.createdAt);

    return d.toDateString() === now.toDateString();
  });

  const olderSessions = sessions.filter((s) => {
    const d = new Date(s.createdAt);

    return d.toDateString() !== now.toDateString();
  });

  const showErrorEmptyState = isError && sessions.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-3 space-y-4">
      {isError && sessions.length > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between px-3 py-1.5 rounded-sm bg-danger/5 border border-danger/20"
        >
          <p className="text-xs text-danger">Failed to refresh chats</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-danger hover:underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {isInitialLoading ? (
        <div role="status" className="py-6 text-center animate-pulse">
          <span className="text-xs text-muted">Loading chats...</span>
        </div>
      ) : showErrorEmptyState ? (
        <div role="alert" className="py-6 text-center space-y-3">
          <p className="text-xs text-muted">Failed to load chats</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-accent hover:underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-muted px-3 py-2">
          {searchTerm ? `No results for "${searchTerm}"` : "No recent chats"}
        </p>
      ) : (
        <>
          {todaySessions.length > 0 && (
            <div>
              <h2 className="text-2xs font-bold uppercase tracking-wider text-muted px-3 mb-1.5">Today</h2>
              <div className="space-y-0.5">
                {todaySessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {olderSessions.length > 0 && (
            <div>
              <h2 className="text-2xs font-bold uppercase tracking-wider text-muted px-3 mb-1.5">Recent</h2>
              <div className="space-y-0.5">
                {olderSessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div ref={loadMoreRef} className="h-1 w-full" />
      {isFetchingNextPage && (
        <div role="status" className="py-2 text-center animate-pulse">
          <span className="text-2xs text-muted">Loading older chats...</span>
        </div>
      )}
    </div>
  );
}
