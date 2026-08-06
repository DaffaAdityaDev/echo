"use client";

import { Bug, ChevronDown, Cpu, Download, Menu, Plus, Settings, Share2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "@/lib/sidebar-context";
import { AgentStatusBadge } from "../AgentStatusBadge";

interface ChatHeaderProps {
  activeModelName: string;
  packetCount: number;
  onOpenWorkspace: () => void;
  onOpenSettings: () => void;
  onToggleDebug: () => void;
  onCreateSession: () => void;
  onShareSession: () => void;
  onExportChat: () => void;
}

export function ChatHeader({
  activeModelName,
  packetCount,
  onOpenWorkspace,
  onOpenSettings,
  onToggleDebug,
  onCreateSession,
  onShareSession,
  onExportChat,
}: ChatHeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="h-16 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between px-6 shrink-0 z-20 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white p-1.5 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Model Selector Header Button */}
        <button
          type="button"
          onClick={onOpenWorkspace}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          title="Select Intelligence Model"
        >
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <Cpu className="h-3.5 w-3.5 text-purple-500" />
          <span>{activeModelName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>

        <AgentStatusBadge />
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2">
        {/* Debug Drawer Toggle Button */}
        <button
          type="button"
          onClick={onToggleDebug}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-all cursor-pointer relative"
          title="Toggle Developer Debug Drawer (Ctrl + `)"
        >
          <Bug className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Debug</span>
          {packetCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Agent Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onCreateSession}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onShareSession}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Copy Session URL Slug"
        >
          <Share2 className="h-4 w-4 text-purple-500" />
        </button>

        <button
          type="button"
          onClick={onExportChat}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors hidden sm:inline-flex cursor-pointer"
          title="Export Chat JSON"
        >
          <Download className="h-4 w-4" />
        </button>

        <Link
          href="/admin"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-all shadow-sm"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Admin Console</span>
        </Link>
      </div>
    </header>
  );
}
