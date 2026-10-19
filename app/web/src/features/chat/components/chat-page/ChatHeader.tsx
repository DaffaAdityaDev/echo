"use client";

import {
  Bug,
  ChevronDown,
  Cpu,
  Download,
  type LucideIcon,
  Menu,
  MoreVertical,
  Plus,
  Settings,
  Share2,
  Square,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { useSidebar } from "@/lib/sidebar-context";
import { AgentStatusBadge } from "../AgentStatusBadge";

interface ChatHeaderProps {
  activeModelName: string;
  packetCount: number;
  isLoading: boolean;
  onStop: () => void;
  onOpenWorkspace: () => void;
  onOpenSettings: () => void;
  onToggleDebug: () => void;
  onCreateSession: () => void;
  onShareSession: () => void;
  onExportChat: () => void;
}

type HeaderAction = DropdownMenuItem & { icon: LucideIcon };

const ICON_BUTTON =
  "p-2 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer";

export function ChatHeader({
  activeModelName,
  packetCount,
  isLoading,
  onStop,
  onOpenWorkspace,
  onOpenSettings,
  onToggleDebug,
  onCreateSession,
  onShareSession,
  onExportChat,
}: ChatHeaderProps) {
  const { toggleSidebar } = useSidebar();

  const secondaryActions: HeaderAction[] = [
    { id: "settings", label: "Agent Settings", icon: Settings, onSelect: onOpenSettings },
    { id: "new", label: "New Chat", icon: Plus, onSelect: onCreateSession },
    { id: "share", label: "Copy Session URL", icon: Share2, onSelect: onShareSession },
    { id: "export", label: "Export Chat JSON", icon: Download, onSelect: onExportChat },
  ];

  return (
    <header className="h-14 sm:h-16 border-b border-border flex items-center justify-between gap-2 px-3 sm:px-6 shrink-0 z-20 bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button type="button" className={`md:hidden ${ICON_BUTTON}`} onClick={toggleSidebar} aria-label="Open sidebar">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="flex items-center gap-2 min-w-0 px-2.5 sm:px-3 py-1.5 rounded-sm border border-border bg-surface text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          title="Select Intelligence Model"
          aria-label={`Model: ${activeModelName}. Change model`}
        >
          <Cpu className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[8rem] sm:max-w-[16rem]">{activeModelName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
        </button>

        <AgentStatusBadge className="hidden sm:inline-flex" />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {isLoading && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-sm border border-danger/30 bg-danger/10 text-danger text-xs font-semibold hover:bg-danger/20 transition-colors cursor-pointer"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span className="hidden sm:inline">Stop</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleDebug}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-sm border border-accent/30 bg-accent-soft text-accent text-xs font-semibold hover:bg-accent/15 transition-colors cursor-pointer"
          title="Toggle Developer Debug Drawer (Ctrl + `)"
          aria-label="Toggle debug drawer"
        >
          <Bug className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Debug</span>
          {packetCount > 0 && <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />}
        </button>

        <div className="hidden sm:flex items-center gap-1">
          {secondaryActions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className={ICON_BUTTON}
                title={action.label}
                aria-label={action.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="sm:hidden">
          <DropdownMenu
            label="More actions"
            icon={MoreVertical}
            items={secondaryActions}
            triggerClassName={ICON_BUTTON}
          />
        </div>
      </div>
    </header>
  );
}
