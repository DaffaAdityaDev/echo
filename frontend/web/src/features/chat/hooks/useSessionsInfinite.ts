import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";

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
  });

  const flattenedSessions = sessionsData ? sessionsData.pages.flatMap((page) => page.sessions) : [];

  useEffect(() => {
    if (flattenedSessions.length === 0) return;
    setSessions(flattenedSessions);
    const currentId = useChatStore.getState().activeSessionId;
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
          queryClient.invalidateQueries({ queryKey: ["sessions"] });
        })
        .catch((err) => {
          console.error("[Chat] Failed to create initial session:", err);
          initialised.current = false;
        });
    }
  }, [sessionsData, setSessions, setActiveSession, queryClient]);

  return { sessions: flattenedSessions, fetchNextPage, hasNextPage, isFetchingNextPage };
}
