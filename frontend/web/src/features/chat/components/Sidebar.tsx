"use client";

import React from "react";
import { 
  Settings, 
  Sparkles, 
  Command, 
  Bot, 
  Cloud, 
  Cpu, 
  ChevronDown 
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { useFeatures } from "../api/useFeatures";
import { useModels } from "../api/useModels";
import { CHAT_MODES } from "../constants";
import type { Model } from "@/lib/queries";

const providerIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  OpenAI: Bot,
  Anthropic: Sparkles,
  "LM Studio": Cpu,
  "OpenCode Go": Cloud,
};

interface SidebarProps {
  mode: typeof CHAT_MODES[keyof typeof CHAT_MODES] | string;
  setMode: (mode: typeof CHAT_MODES[keyof typeof CHAT_MODES]) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  selectedFeatures: string[];
  setSelectedFeatures: React.Dispatch<React.SetStateAction<string[]>>;
}


export function Sidebar({ mode, setMode, selectedModel, setSelectedModel, selectedFeatures, setSelectedFeatures }: SidebarProps) {
  const { features } = useFeatures();
  const { models } = useModels();
  const groupedModels = models.reduce<Record<string, Model[]>>((acc, m) => {
    (acc[m.provider_name] ??= []).push(m);
    return acc;
  }, {});

  return (
    <aside className="w-64 border-r border-white/5 bg-surface flex flex-col p-4 gap-4">
      <div className="flex items-center gap-2 px-2 py-4" translate="no">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center border-glow">
          <Command size={18} className="text-white" aria-hidden="true" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight">ECHO Brain</span>
      </div>

      <nav className="flex-1 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted font-bold px-3 mb-2">Workspace Modes</div>
        
        <button 
          onClick={() => setMode(CHAT_MODES.STANDARD)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
            mode === CHAT_MODES.STANDARD 
              ? "bg-white/5 text-white border border-white/10" 
              : "text-muted hover:bg-white/5 hover:text-white"
          )}
        >
          <Sparkles size={18} className={cn("transition-colors", mode === CHAT_MODES.STANDARD ? "text-accent" : "text-white/40")} aria-hidden="true" />
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
          <Sparkles size={18} className={cn("transition-colors", mode === CHAT_MODES.AGENT ? "text-accent animate-pulse" : "text-white/40")} aria-hidden="true" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-bold leading-tight">Iterative Agent</span>
            <span className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">ReAct Loop</span>
          </div>
        </button>

        <button 
          onClick={() => setMode(CHAT_MODES.NLAH)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
            mode === CHAT_MODES.NLAH 
              ? "bg-accent/15 text-accent border border-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.08)] animate-pulse" 
              : "text-muted hover:bg-white/5 hover:text-white"
          )}
        >
          <Sparkles size={18} className={cn("transition-colors text-success", mode === CHAT_MODES.NLAH ? "text-success animate-bounce" : "text-white/40")} aria-hidden="true" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-bold leading-tight">Deep Research</span>
            <span className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">NLAH Sub-Agents</span>
          </div>
        </button>

        <div className="pt-4 border-t border-white/5 mt-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted transition-all hover:bg-white/5 hover:text-white group">
            <Settings size={18} aria-hidden="true" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </nav>

      {/* Dynamic Capabilities Panel (for Agent / NLAH Modes only) */}
      {(mode === CHAT_MODES.AGENT || mode === CHAT_MODES.NLAH) && features.length > 0 && (
        <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider text-muted font-bold px-3 mb-1">Agent Capabilities</div>
          <div className="space-y-1.5 px-3 max-h-48 overflow-y-auto scrollbar-hide">
            {features.map((f) => (
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
                  className="mt-0.5 rounded border-white/10 bg-white/5 text-accent focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                />
                <div className="flex flex-col">
                  <span className="font-semibold flex items-center gap-1.5">
                    {f.name}
                    {f.locked && (
                      <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-warning/20 text-warning uppercase border border-warning/30">
                        PRO
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-white/40 leading-tight">{f.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2 block">Active Model</div>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
            {Object.entries(groupedModels).map(([provider, providerModels]) => {
              const Icon = providerIcon[provider];
              return (
                <details key={provider} className="group" open>
                  <summary className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60 transition-colors list-none">
                    {Icon && <Icon size={12} aria-hidden="true" />}
                    <span>{provider}</span>
                    <ChevronDown size={10} className="ml-auto group-open:rotate-180 transition-transform" aria-hidden="true" />
                  </summary>
                  <div className="mt-1 space-y-0.5 pl-1">
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
        </div>
      </div>
    </aside>
  );
}
