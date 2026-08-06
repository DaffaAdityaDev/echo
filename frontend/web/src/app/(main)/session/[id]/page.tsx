"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatPage } from "@/features/chat";
import { useChatStore } from "@/features/chat/stores/chatStore";

export default function SessionSlugPage() {
  const params = useParams();
  const sessionId = params?.id as string | undefined;
  const setActiveSession = useChatStore((s) => s.setActiveSession);

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
  }, [sessionId, setActiveSession]);

  return <ChatPage />;
}
