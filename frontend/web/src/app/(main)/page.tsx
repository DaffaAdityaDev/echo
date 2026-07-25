"use client"

import { useChatPage, ChatPage } from "@/features/chat"

export default function Home() {
  const chatProps = useChatPage()

  return <ChatPage {...chatProps} />
}
