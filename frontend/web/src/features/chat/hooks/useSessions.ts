import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";

export function useSessions() {
  const { sessions, activeSessionId, setSessions, setActiveSession, clearMessages } = useChatStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const createSession = useCallback(() => {
    setActiveSession(null);
    clearMessages();
    if (pathname !== "/") {
      router.push("/");
    }
  }, [setActiveSession, clearMessages, router, pathname]);

  const deleteSession = useCallback(
    async (id: string) => {
      setSessions(sessions.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSession(null);
        clearMessages();
        if (pathname !== "/") {
          router.push("/");
        }
      }
      try {
        await sessionApi.delete(id);
      } catch (e) {
        console.error("Failed to delete session on backend:", e);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    },
    [sessions, activeSessionId, setSessions, setActiveSession, clearMessages, queryClient, router, pathname],
  );

  const selectSession = useCallback(
    async (id: string) => {
      setActiveSession(id);
    },
    [setActiveSession],
  );

  return { sessions, activeSessionId, createSession, deleteSession, selectSession };
}
