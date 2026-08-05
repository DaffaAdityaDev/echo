"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { AuthGuard } from "@/features/auth";
import { SessionSidebar } from "@/features/chat/components/SessionSidebar";
import { SidebarContext } from "@/lib/sidebar-context";

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === "/";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((v) => !v);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <AuthGuard>
      <SidebarContext.Provider value={{ sidebarOpen, toggleSidebar }}>
        <div
          className={`flex bg-white bg-grid-tech font-mono text-foreground ${isChatRoute ? "h-screen overflow-hidden" : "min-h-screen"}`}
        >
          <SessionSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          {isChatRoute ? (
            children
          ) : (
            <main className="flex-1 min-h-0 overflow-y-auto p-6">
              <button
                type="button"
                className="md:hidden mb-4 p-2 rounded-lg bg-white border border-zinc-200 shadow-md cursor-pointer"
                onClick={toggleSidebar}
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              {children}
            </main>
          )}
        </div>
      </SidebarContext.Provider>
    </AuthGuard>
  );
}
