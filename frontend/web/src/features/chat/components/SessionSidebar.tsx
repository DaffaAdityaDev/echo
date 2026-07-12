"use client";

import React from "react";
import Link from "next/link";
import {
  Command,
  MessageCircle,
  Bot,
  Settings,
  Sparkles,
  Cpu,
  Cloud,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { CHAT_MODES } from "../constants";
import { useChatStore } from "../stores/chatStore";
import { useModels } from "../hooks/useModels";
import { useFeatures } from "../hooks/useFeatures";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Model } from "@/lib/queries";

const providerIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  OpenAI: Bot,
  Anthropic: Sparkles,
  "LM Studio": Cpu,
  "OpenCode Go": Cloud,
};

interface SessionSidebarProps {
  createSession: () => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function SessionSidebar({
  createSession,
  deleteSession,
  selectSession,
  isOpen = false,
  onClose,
}: SessionSidebarProps) {
  const { selectedModel, setSelectedModel, mode, setMode, selectedFeatures, setSelectedFeatures, sessions, activeSessionId } = useChatStore();
  const { models } = useModels();
  const { features, isLoading: featuresLoading, isError: featuresError } = useFeatures();
  const { user, logout } = useAuth();
  const groupedModels = models.reduce<Record<string, Model[]>>((acc, m) => {
    (acc[m.provider_name] ??= []).push(m);
    return acc;
  }, {});

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        "w-64 border-r border-white/5 bg-surface flex flex-col h-full transition-transform duration-300 z-50 shrink-0",
        "fixed inset-y-0 left-0 md:static md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 py-4 shrink-0" translate="no">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center border-glow">
              <Command size={18} className="text-white" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">ECHO Brain</span>
          </div>
          {onClose && (
            <button
              className="md:hidden text-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-3 mb-2">
          <button
            onClick={createSession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-all text-sm font-bold"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-bold px-2 mb-2 mt-1">
            Sessions
          </div>

          {sessions.length === 0 ? (
            <p className="text-[10px] text-muted px-2 py-2">No sessions yet</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 cursor-pointer relative",
                  session.id === activeSessionId
                    ? "bg-white/5 text-white border border-white/10"
                    : "text-muted hover:bg-white/5 hover:text-white"
                )}
                onClick={() => selectSession(session.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate leading-tight">{session.title}</p>
                  <p className="text-[9px] text-muted/60 mt-0.5">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                  className="p-1 rounded-lg text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  aria-label="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}

          <div className="pt-3 mt-2 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-muted font-bold px-2 mb-2">Workspace Modes</div>

            <button
              onClick={() => setMode(CHAT_MODES.STANDARD)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
                mode === CHAT_MODES.STANDARD
                  ? "bg-white/5 text-white border border-white/10"
                  : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <MessageCircle size={18} className={cn("transition-colors", mode === CHAT_MODES.STANDARD ? "text-accent" : "text-white/40")} aria-hidden="true" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold leading-tight">Standard Chat</span>
                <span className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Direct Response</span>
              </div>
            </button>

            <button
              onClick={() => setMode(CHAT_MODES.AGENT)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
                mode === CHAT_MODES.AGENT
                  ? "bg-accent/10 text-accent border border-accent/20 shadow-[0_0_15px_rgba(37,99,235,0.05)]"
                  : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <Bot size={18} className={cn("transition-colors", mode === CHAT_MODES.AGENT ? "text-accent animate-pulse" : "text-white/40")} aria-hidden="true" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold leading-tight">Iterative Agent</span>
                <span className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">ReAct Loop</span>
              </div>
            </button>

            {mode === CHAT_MODES.AGENT && (
              <details className="group mt-2" open>
                <summary className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold text-muted uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors list-none">
                  <ChevronRight size={12} className="group-open:rotate-90 transition-transform shrink-0" />
                  Agent Capabilities
                  {features.length > 0 && (
                    <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded-full ml-auto">{features.length}</span>
                  )}
                </summary>
                <div className="mt-1 space-y-0.5">
                  {featuresError ? (
                    <p className="text-[10px] text-error/80 px-2 py-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> Failed to load
                    </p>
                  ) : featuresLoading ? (
                    <p className="text-[10px] text-muted px-2 py-1 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Loading...
                    </p>
                  ) : features.length === 0 ? (
                    <p className="text-[10px] text-muted px-2 py-1">No capabilities loaded</p>
                  ) : (
                    features.map((f) => (
                      <label
                        key={f.id}
                        className={cn(
                          "flex items-start gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs hover:bg-white/[0.02]",
                          f.locked ? "opacity-40 cursor-not-allowed" : "text-white/80"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFeatures.includes(f.id)}
                          disabled={f.locked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFeatures(prev => [...prev, f.id]);
                            } else {
                              setSelectedFeatures(prev => prev.filter(id => id !== f.id));
                            }
                          }}
                          className="mt-0.5 rounded border-white/10 bg-white/5 text-accent focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold flex items-center gap-1.5 truncate">
                            {f.name}
                            {f.locked && (
                              <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-warning/20 text-warning uppercase border border-warning/30 shrink-0">
                                PRO
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-white/40 leading-tight truncate">{f.description}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </details>
            )}

            <details className="group mt-2">
              <summary className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold text-muted uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors list-none">
                <ChevronRight size={12} className="group-open:rotate-90 transition-transform shrink-0" />
                Active Model
                {selectedModel && (
                  <span className="text-[9px] font-normal lowercase text-white/40 ml-auto truncate max-w-[100px]">
                    {models.find(m => m.id === selectedModel)?.name || selectedModel}
                  </span>
                )}
              </summary>
              <div className="mt-1 space-y-0.5">
                {Object.entries(groupedModels).map(([provider, providerModels]) => {
                  const Icon = providerIcon[provider];
                  return (
                    <details key={provider} className="group" open>
                      <summary className="flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors list-none">
                        {Icon && <Icon size={12} aria-hidden="true" />}
                        <span>{provider}</span>
                        <ChevronDown size={10} className="ml-auto group-open:rotate-180 transition-transform" aria-hidden="true" />
                      </summary>
                      <div className="mt-0.5 space-y-0.5">
                        {providerModels.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all",
                              selectedModel === m.id
                                ? "bg-accent/10 text-accent border border-accent/20"
                                : "text-white/50 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          </div>
        </nav>

        <div className="border-t border-white/5 shrink-0">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-muted hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <Settings size={16} aria-hidden="true" />
            <span className="font-medium">Settings</span>
            <ChevronRight size={14} className="ml-auto text-white/20" />
          </Link>

          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <User size={14} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email || "Not signed in"}</p>
              {user?.role && (
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted">{user.role}</span>
              )}
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
