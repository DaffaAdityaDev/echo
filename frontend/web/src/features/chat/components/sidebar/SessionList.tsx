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
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
          <p className="text-[10px] text-red-500/80">Failed to refresh chats</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[10px] font-semibold text-red-500 hover:underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {isInitialLoading ? (
        <div className="py-6 text-center animate-pulse">
          <span className="text-[11px] text-zinc-400">Loading chats...</span>
        </div>
      ) : showErrorEmptyState ? (
        <div className="py-6 text-center space-y-3">
          <p className="text-[11px] text-zinc-400">Failed to load chats</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-[11px] text-zinc-400 px-3 py-2">No recent chats</p>
      ) : (
        <>
          {todaySessions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-1.5">Today</h4>
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
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-1.5">Recent</h4>
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
        <div className="py-2 text-center animate-pulse">
          <span className="text-[10px] text-zinc-400">Loading older chats...</span>
        </div>
      )}
    </div>
  );
}
