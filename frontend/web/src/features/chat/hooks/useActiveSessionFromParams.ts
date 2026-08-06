import { useEffect } from "react";
import { useSetActiveSession } from "./useChatSelectors";

export function useActiveSessionFromParams(sessionId: string | undefined) {
  const setActiveSession = useSetActiveSession();

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
  }, [sessionId, setActiveSession]);
}
