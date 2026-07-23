"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Compass,
  Library,
  Folder,
  History,
  LogOut,
  User,
  Trash2,
  X,
  Sparkles,
  Command,
  PanelLeftClose,
  Settings,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useChatStore } from "../stores/chatStore";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface SessionSidebarProps {
  createSession: () => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

export function SessionSidebar({
  createSession,
  deleteSession,
  selectSession,
  isOpen = false,
  onClose,
  onOpenSettings,
}: SessionSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { sessions, activeSessionId } = useChatStore();
  const { user, logout } = useAuth();

  // Filter sessions by search term
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group sessions by recency
  const now = new Date();
  const todaySessions = filteredSessions.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toDateString() === now.toDateString();
  });
  const olderSessions = filteredSessions.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toDateString() !== now.toDateString();
  });

  const navItems = [
    { label: "Explore", icon: Compass, href: "#" },
    { label: "Library", icon: Library, href: "#" },
    { label: "Files", icon: Folder, href: "#" },
    { label: "History", icon: History, href: "#" },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-64 bg-zinc-50/80 dark:bg-zinc-950/60 border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col h-full transition-transform duration-300 z-50 shrink-0 select-none",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Plus className="h-5 w-5" />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
              Echo
            </span>
          </div>
          {onClose ? (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Primary Action Button: + New chat */}
        <div className="px-4 mb-3">
          <button
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-all text-xs font-semibold shadow-md active:scale-98 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Search Input Box */}
        <div className="px-4 mb-4">
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 absolute left-3 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-300/40 dark:border-zinc-800/60 rounded-xl pl-8 pr-8 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
            <span className="absolute right-2.5 text-[10px] font-mono text-zinc-400 bg-zinc-300/40 dark:bg-zinc-800 px-1 py-0.5 rounded">
              ⌘K
            </span>
          </div>
        </div>

        {/* Core Nav Links */}
        <div className="px-3 mb-4 space-y-0.5">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <a
                key={idx}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>

        {/* Grouped Session History */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-zinc-400 px-3 py-2">No recent chats</p>
          ) : (
            <>
              {todaySessions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                    Today
                  </h4>
                  <div className="space-y-0.5">
                    {todaySessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => selectSession(session.id)}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer relative",
                          session.id === activeSessionId
                            ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/40"
                        )}
                      >
                        <span className="truncate pr-2">{session.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {olderSessions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                    Recent
                  </h4>
                  <div className="space-y-0.5">
                    {olderSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => selectSession(session.id)}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer relative",
                          session.id === activeSessionId
                            ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/40"
                        )}
                      >
                        <span className="truncate pr-2">{session.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
                title="Agent Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
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
    </>
  );
}
