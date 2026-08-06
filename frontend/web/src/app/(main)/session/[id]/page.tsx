"use client";

import { useParams } from "next/navigation";
import { ChatPage } from "@/features/chat";
import { useActiveSessionFromParams } from "@/features/chat/hooks/useActiveSessionFromParams";

export default function SessionSlugPage() {
  const params = useParams();
  const sessionId = params?.id as string | undefined;
  useActiveSessionFromParams(sessionId);

  return <ChatPage />;
}
