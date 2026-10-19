import { useEffect } from "react";
import { stopStreamOutsideSession } from "../services/stream/stop-stream";
import { useChatStore } from "../stores/chatStore";

export function useActiveSessionFromParams(sessionId: string | undefined) {
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  useEffect(() => {
    if (!sessionId) return;
    stopStreamOutsideSession(sessionId);
    setActiveSession(sessionId);
  }, [sessionId, setActiveSession]);
}
