"use client";

import React from "react";
import { Settings as SettingsIcon, Save, RotateCcw, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { CHAT_MODES } from "@/features/chat/constants";
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

  if (!loaded) return null;

  return (
    <div className="h-screen bg-background text-foreground overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-muted hover:text-foreground transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Settings</h1>
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Agent Preferences</p>
            </div>
          </div>
          <button
            onClick={resetConfig}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:text-error hover:bg-error/10 transition-all"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* Toast */}
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium transition-all duration-300",
          saved ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        )}>
          Settings saved
        </div>

        {/* Default Mode */}
        <section className="bg-surface border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold">Default Mode</h2>
          </div>
          <p className="text-xs text-muted">Choose the default chat mode when opening the app.</p>
          <div className="flex gap-2">
            {([CHAT_MODES.STANDARD, CHAT_MODES.AGENT] as const).map((value) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border",
                  config.defaultMode === value
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-white/[0.02] text-muted border-white/5 hover:bg-white/5 hover:text-foreground"
                )}
              >
                {value === "standard" ? "Standard" : "Agent"}
              </button>
            ))}
          </div>
        </section>

        {/* Default Model */}
        <section className="bg-surface border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold">Default Model</h2>
          </div>
          <p className="text-xs text-muted">Select the default model for new conversations.</p>
          <select
            value={config.defaultModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Auto-select first available</option>
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <optgroup key={provider} label={provider}>
                {providerModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </section>

        {/* Default Features */}
        <section className="bg-surface border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold">Default Features</h2>
          </div>
          <p className="text-xs text-muted">Agent capabilities enabled by default.</p>
          {features.length === 0 ? (
            <p className="text-xs text-muted">No features available.</p>
          ) : (
            <div className="space-y-2">
              {features.map((f) => (
                <label
                  key={f.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                    f.locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.02]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={config.defaultFeatures.includes(f.id)}
                    disabled={f.locked}
                    onChange={() => handleFeatureToggle(f.id)}
                    className="rounded border-white/10 bg-white/5 text-accent focus:ring-0 focus:ring-offset-0 w-4 h-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {f.name}
                      {f.locked && (
                        <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-warning/20 text-warning uppercase border border-warning/30">
                          PRO
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted">{f.description}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Default Skills */}
        <section className="bg-surface border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold">Default Skills</h2>
          </div>
          <p className="text-xs text-muted">Agent skills enabled by default.</p>
          {skills.length === 0 ? (
            <p className="text-xs text-muted">No skills available.</p>
          ) : (
            <div className="space-y-2">
              {skills.map((s) => (
                <label
                  key={s.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.02]"
                >
                  <input
                    type="checkbox"
                    checked={config.defaultSkills.includes(s.name)}
                    onChange={() => handleSkillToggle(s.name)}
                    className="rounded border-white/10 bg-white/5 text-accent focus:ring-0 focus:ring-offset-0 w-4 h-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-[10px] text-muted">{s.description}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={async () => {
            const ok = await handleSave();
            if (ok) router.push("/");
          }}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-all"
        >
          <Save size={16} />
          Save & Return
        </button>
      </div>
    </div>
  );
}
