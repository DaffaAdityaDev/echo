"use client";

import React from "react";
import { Settings as SettingsIcon, Save, RotateCcw, ChevronLeft, Sliders, Cpu, Zap, Code } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { CHAT_MODES } from "@/features/chat/constants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import type { AgentConfig } from "../types";
import type { AgentFeature } from "@/features/chat/hooks/useFeatures";
import type { AgentSkill } from "@/features/chat/hooks/useSkills";
import type { Model } from "@/lib/queries";

interface SettingsPageProps {
  config: AgentConfig;
  loaded: boolean;
  features: AgentFeature[];
  skills: AgentSkill[];
  models: Model[];
  groupedModels: Record<string, Model[]>;
  saved: boolean;
  handleModeChange: (value: string) => void;
  handleModelChange: (value: string) => void;
  handleFeatureToggle: (id: string) => void;
  handleSkillToggle: (name: string) => void;
  resetConfig: () => void;
  handleSave: () => Promise<boolean>;
}

export function SettingsPage({
  config,
  loaded,
  features,
  skills,
  groupedModels,
  saved,
  handleModeChange,
  handleModelChange,
  handleFeatureToggle,
  handleSkillToggle,
  resetConfig,
  handleSave,
}: SettingsPageProps) {
  const router = useRouter();

  if (!loaded) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm font-medium">
        Loading preferences...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground overflow-y-auto relative">
      {/* Toast Notification */}
      <Toast show={saved} message="Agent settings successfully saved!" type="success" />

      {/* Ambient background blur */}
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-zinc-400 hover:text-white transition-colors p-2 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800"
            >
              <ChevronLeft size={18} />
            </Link>
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <SettingsIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-zinc-100">
                Agent Settings
              </h1>
              <p className="text-xs text-zinc-400">Manage defaults, capabilities, and active skills.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetConfig}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 text-xs"
          >
            <RotateCcw size={14} />
            Reset Defaults
          </Button>
        </div>

        {/* Default Execution Mode */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Default Execution Mode</h2>
          </div>
          <p className="text-xs text-zinc-400">Choose the execution strategy when launching conversations.</p>
          <div className="grid grid-cols-2 gap-3">
            {([CHAT_MODES.STANDARD, CHAT_MODES.AGENT] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                className={cn(
                  "p-4 rounded-xl text-left transition-all border font-medium text-xs flex flex-col gap-1 cursor-pointer",
                  config.defaultMode === value
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/5"
                    : "bg-zinc-950/40 border-zinc-800/60 text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm capitalize">{value} Mode</span>
                  {config.defaultMode === value && (
                    <Badge variant="success" className="text-[10px] py-0">Default</Badge>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                  {value === "standard"
                    ? "Direct model response streaming."
                    : "Multi-step agent loop with harness tools & planning."}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Default Model */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Default Intelligence Model</h2>
          </div>
          <p className="text-xs text-zinc-400">Select default model provider for new sessions.</p>
          <select
            value={config.defaultModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/50 transition-colors"
            style={{ colorScheme: "dark" }}
          >
            <option value="">Auto-select first available</option>
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <optgroup key={provider} label={provider}>
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </section>

        {/* Default Capabilities */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Default Harness Capabilities</h2>
          </div>
          <p className="text-xs text-zinc-400">Agent tool execution features enabled by default.</p>
          {features.length === 0 ? (
            <p className="text-xs text-zinc-500">No features available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((f) => (
                <label
                  key={f.id}
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-700/80",
                    f.locked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={config.defaultFeatures.includes(f.id)}
                    disabled={f.locked}
                    onChange={() => handleFeatureToggle(f.id)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      {f.name}
                      {f.locked && <Badge variant="warning" className="text-[9px] py-0">PRO</Badge>}
                    </span>
                    <span className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{f.description}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Default Skills */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Default Agent Skills</h2>
          </div>
          <p className="text-xs text-zinc-400">Specialized skills autoloaded during agent initialization.</p>
          {skills.length === 0 ? (
            <p className="text-xs text-zinc-500">No skills available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {skills.map((s) => (
                <label
                  key={s.name}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-700/80"
                >
                  <input
                    type="checkbox"
                    checked={config.defaultSkills.includes(s.name)}
                    onChange={() => handleSkillToggle(s.name)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200">{s.name}</span>
                    <span className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{s.description}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Save Controls */}
        <Button
          onClick={async () => {
            const ok = await handleSave();
            if (ok) router.push("/");
          }}
          size="lg"
          className="w-full gap-2 font-semibold shadow-xl shadow-blue-600/20"
        >
          <Save size={16} />
          Save Preferences & Return
        </Button>
      </div>
    </div>
  );
}
