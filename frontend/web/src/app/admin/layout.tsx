"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Key, ArrowLeft, Terminal, ShieldAlert } from "lucide-react";
import { cn } from "@/utils/cn";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Overview",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: "API Keys",
      href: "/admin/api-keys",
      icon: Key,
    },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden w-full">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col justify-between shrink-0">
        <div className="flex flex-col flex-1 py-6">
          {/* Logo Area */}
          <div className="px-6 mb-8 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-blue-500" />
            <div>
              <span className="font-display font-bold text-sm tracking-tight block">ECHO Admin</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Management Console</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 px-4">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                    active
                      ? "text-blue-500 bg-blue-500/5 font-semibold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-blue-500 rounded-r" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-blue-500" : "text-zinc-500 group-hover:text-zinc-300")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with back navigation */}
        <div className="p-4 border-t border-zinc-800/80 space-y-2">
          <Link
            href="/docs"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 transition-all"
          >
            <Terminal className="h-3.5 w-3.5" />
            API Documentation
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Orchestrator
          </Link>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main id="main-content" className="flex-1 overflow-y-auto bg-zinc-950/20 p-8 md:p-10 relative">
        {children}
      </main>
    </div>
  );
}
