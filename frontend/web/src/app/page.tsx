"use client";

import { useChatPage, ChatPage } from "@/features/chat";
import { AuthGuard } from "@/features/auth";

export default function Home() {
  const chatProps = useChatPage();

  return (
    <AuthGuard>
      <ChatPage {...chatProps} />
    </AuthGuard>
  );
}
