"use client";

import { Activity, BookOpen, Layers, LogOut, MessageSquare, Plus, ScrollText, Search, Square, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "@/utils/cn";
import { useSessions } from "../hooks/useSessions";
import { useSessionsInfinite } from "../hooks/useSessionsInfinite";
import { stopActiveStream } from "../services/stream/stop-stream";
import { useChatStore } from "../stores/chatStore";
import { SessionList } from "./sidebar/SessionList";

interface SessionSidebarProps {
  createSession?: () => void;
  deleteSession?: (id: string) => void;
  selectSession?: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function SessionSidebar({
  createSession: createSessionProp,
  deleteSession: deleteSessionProp,
  selectSession: selectSessionProp,
  isOpen = false,
  onClose,
}: SessionSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const { sessions, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isInitialLoading, refetch } =
    useSessionsInfinite();

  const {
    activeSessionId,
    createSession: storeCreateSession,
    deleteSession: storeDeleteSession,
    selectSession: storeSelectSession,
  } = useSessions();

  const isLoading = useChatStore((s) => s.isLoading);
  const { user, logout } = useAuth();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  const isErrorRef = useRef(isError);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
    isErrorRef.current = isError;
  }, [hasNextPage, isFetchingNextPage, isError]);

  useEffect(() => {
    const el = loadMoreRef.current;

    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasNextPageRef.current &&
          !isFetchingNextPageRef.current &&
          !isErrorRef.current
        ) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage]);

  const handleCreateSession = async () => {
    if (createSessionProp) {
      await createSessionProp();
    } else {
      storeCreateSession();
    }
  };

  const handleDeleteSession = deleteSessionProp || storeDeleteSession;

  const handleSelectSession = async (id: string) => {
    if (selectSessionProp) {
      await selectSessionProp(id);
    } else {
      await storeSelectSession(id);
    }

    router.push(`/session/${id}`);
  };

  // Filter sessions by search term
  const filteredSessions = sessions.filter((s) => s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const navItems = [
    { label: "Chat", icon: MessageSquare, href: "/" },
    { label: "Traces", icon: Activity, href: "/traces" },
    { label: "AI Maturity", icon: Layers, href: "/maturity" },
    { label: "Prompts", icon: ScrollText, href: "/prompts" },
    { label: "Docs", icon: BookOpen, href: "/docs" },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Sidebar"
        className={cn(
          "w-64 bg-surface md:bg-surface/80 border-r border-border flex flex-col h-full transition-transform duration-300 z-50 shrink-0 select-none",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer rounded-sm">
            <div className="p-1.5 rounded-sm bg-accent-soft border border-accent/20 text-accent">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-lg tracking-section text-foreground">Echo</span>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="md:hidden text-muted hover:text-foreground hover:bg-surface-hover p-1.5 rounded-sm transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Primary Action Button: + New chat */}
        <div className="px-4 mb-3 space-y-2">
          <button
            type="button"
            onClick={handleCreateSession}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-sm bg-primary text-primary-foreground hover:bg-primary-hover transition-all text-xs font-semibold shadow-sm active:scale-98 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New chat</span>
          </button>

          {isLoading && (
            <button
              type="button"
              onClick={stopActiveStream}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-sm border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 transition-all text-xs font-semibold active:scale-98 cursor-pointer"
            >
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Search Input Box */}
        <div className="px-4 mb-4">
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 absolute left-3 text-subtle pointer-events-none" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              name="chat-search"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              placeholder="Search"
              aria-label="Search chats"
              aria-keyshortcuts="Control+K Meta+K"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-elevated border border-border rounded-sm pl-8 pr-9 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus-visible:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
            <kbd
              aria-hidden="true"
              className="absolute right-2 text-2xs font-mono text-muted bg-surface-hover border border-border px-1 rounded-sm pointer-events-none"
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Core Nav Links */}
        <nav aria-label="Primary" className="px-3 mb-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-surface-hover text-foreground font-semibold shadow-xs"
                    : "text-muted hover:text-foreground hover:bg-surface-hover/70",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-muted")} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Grouped Session History */}
        <SessionList
          sessions={filteredSessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          loadMoreRef={loadMoreRef}
          isFetchingNextPage={isFetchingNextPage}
          isInitialLoading={isInitialLoading}
          isError={isError}
          onRetry={refetch}
          searchTerm={searchTerm}
        />

        {/* User Profile Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-sm">
            <div
              aria-hidden="true"
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-gb-dark-blue flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0 shadow-sm"
            >
              {user?.email ? user.email[0].toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user?.email?.split("@")[0] || "Guest User"}
              </p>
              <p className="text-2xs text-muted truncate">{user?.email || "guest@echo.ai"}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="p-1.5 rounded-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0 cursor-pointer"
              title="Logout"
              aria-label="Log out"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
