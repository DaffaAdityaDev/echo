import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";
import type { Session } from "../types";

export function useSessionsInfinite() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
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
    queryKey: ["sessions"],
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
          queryClient.invalidateQueries({ queryKey: ["sessions"], exact: true });
        })
        .catch((err) => {
          console.error("[Chat] Failed to create initial session:", err);
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
    isInitialLoading,
    refetch,
  };
}
