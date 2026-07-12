"use client";

import { useState } from "react";
import { ChatPage } from "@/features/chat/components/ChatPage";
import { AuthGuard } from "@/features/auth/components/AuthGuard";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <ChatPage
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
    </AuthGuard>
  );
}
