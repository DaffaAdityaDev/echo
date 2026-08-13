import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { CHAT_QUERY_KEYS } from "../constants";
import { sessionApi } from "../services/chat-api";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";
import type { Session } from "../types";

export function useSessionsInfinite() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const setSessions = useChatStore((s) => s.setSessions);
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  const {
    data: sessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    isInitialLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.sessions,
    queryFn: ({ pageParam = 0 }) => sessionApi.list(10, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    ...QUERY_STANDARD,
  });

  const flattenedSessions = useMemo(() => {
    const seen = new Set<string>();
    const unique: Session[] = [];
    for (const page of sessionsData?.pages ?? []) {
      for (const session of page.sessions) {
        if (!seen.has(session.id)) {
          seen.add(session.id);
          unique.push(session);
        }
      }
    }
    return unique;
  }, [sessionsData]);

  useEffect(() => {
    if (flattenedSessions.length === 0) return;
    setSessions(flattenedSessions);
    const store = useChatStore.getState();
    if (store.newChatPending) return;
    const currentId = store.activeSessionId;
    const urlSessionMatch = pathname.match(/^\/(?:session|c)\/([^/]+)/);
    if (urlSessionMatch) return;
    if (!currentId || !flattenedSessions.some((s) => s.id === currentId)) {
      setActiveSession(flattenedSessions[0].id);
    }
  }, [flattenedSessions, pathname, setSessions, setActiveSession]);

  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    if (sessionsData && sessionsData.pages[0]?.sessions.length === 0) {
      initialised.current = true;
      sessionApi
        .create()
        .then((session) => {
          setSessions([session]);
          setActiveSession(session.id);
          queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
        })
        .catch(() => {
          notifySystem("error", "INITIAL_SESSION_FAILED", "Failed to create an initial session.");
          initialised.current = false;
        });
    }
  }, [sessionsData, setSessions, setActiveSession, queryClient]);

  return {
    sessions: flattenedSessions,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    isInitialLoading: (isInitialLoading || isAuthLoading) && flattenedSessions.length === 0,
    refetch,
  };
}
