"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Key, ArrowLeft, Terminal, ShieldCheck } from "lucide-react";
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
    <div className="h-screen w-screen bg-white dark:bg-zinc-950 text-foreground font-sans overflow-hidden flex relative">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-950/60 flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col flex-1 py-6">
          {/* Logo Area */}
          <div className="px-6 mb-8 flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display font-bold text-sm tracking-tight block text-zinc-900 dark:text-white">
                ECHO Admin
              </span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                Management Console
              </span>
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative",
                    active
                      ? "text-purple-600 dark:text-purple-400 bg-purple-500/10 font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/50"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-purple-500 rounded-r" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-purple-500" : "text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
          <Link
            href="/docs"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/50 transition-all"
          >
            <Terminal className="h-3.5 w-3.5" />
            API Documentation
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/50 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Orchestrator
          </Link>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main id="main-content" className="flex-1 overflow-y-auto p-6 md:p-10 relative">
        {children}
      </main>
    </div>
  );
}
