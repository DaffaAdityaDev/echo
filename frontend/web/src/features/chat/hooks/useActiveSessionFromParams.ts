import { useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

export function useActiveSessionFromParams(sessionId: string | undefined) {
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
  }, [sessionId, setActiveSession]);
}
