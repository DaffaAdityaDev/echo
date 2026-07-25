"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { StudioSidebar } from "@/features/studio"
import { AuthGuard } from "@/features/auth"

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChatRoute = pathname === "/"

  return (
    <AuthGuard>
      {isChatRoute ? (
        <div className="h-screen w-screen overflow-hidden bg-zinc-950">{children}</div>
      ) : (
        <div className="flex min-h-screen bg-zinc-950">
          <StudioSidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      )}
    </AuthGuard>
  )
}
