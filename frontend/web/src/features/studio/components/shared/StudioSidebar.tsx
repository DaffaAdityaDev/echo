"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Plus,
  Sparkles,
  LayoutDashboard,
  Layers,
  FlaskConical,
  ScrollText,
  ClipboardCheck,
  Eye,
  ShieldAlert,
  LogOut,
  Settings,
} from "lucide-react"
import { cn } from "@/utils/cn"
import { useAuth } from "@/features/auth/hooks/useAuth"

const NAV_ITEMS = [
  { label: "Chat Assistant", href: "/", icon: Sparkles },
  { label: "Studio Overview", href: "/studio", icon: LayoutDashboard },
  { label: "AI Maturity", href: "/maturity", icon: Layers },
  { label: "Playground", href: "/playground", icon: FlaskConical },
  { label: "Evals", href: "/evals", icon: ClipboardCheck },
  { label: "Prompts", href: "/prompts", icon: ScrollText },
  { label: "Shadow", href: "/shadow", icon: Eye },
  { label: "Audit", href: "/audit", icon: ShieldAlert },
]

export function StudioSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="w-64 bg-zinc-50/80 dark:bg-zinc-950/60 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col h-full transition-transform duration-300 z-50 shrink-0 select-none min-h-screen">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
            Echo
          </span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="px-4 mb-3">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-all text-xs font-semibold shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New chat</span>
        </Link>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/50"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-purple-500" : "text-zinc-500")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-200/40 dark:hover:bg-zinc-900/40 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
            {user?.email ? user.email[0].toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {user?.email?.split("@")[0] || "Guest User"}
            </p>
            <p className="text-[10px] text-zinc-400 truncate">
              {user?.email || "guest@echo.ai"}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition-colors shrink-0"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
