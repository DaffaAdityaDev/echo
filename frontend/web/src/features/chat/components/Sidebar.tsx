"use client";

import React from "react";
import { 
  LayoutDashboard, 
  ChevronRight, 
  Settings, 
  Sparkles, 
  Command 
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { useModels } from "../api/useModels";
import { CHAT_MODES } from "../constants";

interface SidebarProps {
  mode: typeof CHAT_MODES[keyof typeof CHAT_MODES] | string;
  setMode: (mode: typeof CHAT_MODES[keyof typeof CHAT_MODES]) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
}


export function Sidebar({ mode, setMode, selectedModel, setSelectedModel }: SidebarProps) {
  const { models } = useModels();

  return (
    <aside className="w-64 border-r border-white/5 bg-surface flex flex-col p-4 gap-4">
      <div className="flex items-center gap-2 px-2 py-4" translate="no">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center border-glow">
          <Command size={18} className="text-white" aria-hidden="true" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight">ECHO Brain</span>
      </div>

      <nav className="flex-1 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 text-white transition-all hover:bg-white/10 group">
          <LayoutDashboard size={18} className="text-accent" aria-hidden="true" />
          <span className="text-sm font-medium">Missions</span>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </button>
        
        <button 
          onClick={() => setMode(mode === CHAT_MODES.AGENT ? CHAT_MODES.STANDARD : CHAT_MODES.AGENT)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
            mode === CHAT_MODES.AGENT 
              ? "bg-accent/10 text-accent border border-accent/20 shadow-[0_0_15px_rgba(37,99,235,0.05)]" 
              : "text-muted hover:bg-white/5 hover:text-white"
          )}
        >
          <Sparkles size={18} className={cn("transition-colors", mode === CHAT_MODES.AGENT ? "text-accent" : "text-white/40")} aria-hidden="true" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-bold leading-tight">Mission Mode</span>
            <span className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">Iterative Agent</span>
          </div>
          {mode === CHAT_MODES.AGENT && (
            <motion.div 
              layoutId="active-glow"
              className="absolute inset-0 bg-accent/5 blur-xl -z-10"
            />
          )}
        </button>

        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted transition-all hover:bg-white/5 hover:text-white group">
          <Settings size={18} aria-hidden="true" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="px-3 py-2">
          <label htmlFor="model-select" className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2 block">Active Model</label>
          <select 
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent/50 transition-colors cursor-pointer"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#0a0a0a]">
                {m.name || m.id}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
