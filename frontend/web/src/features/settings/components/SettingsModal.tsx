"use client";

import React, { useState } from "react";
import {
  X,
  Sliders,
  Cpu,
  Zap,
  Code,
  Save,
  RotateCcw,
  ShieldCheck,
  User,
  Key,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { CHAT_MODES } from "@/features/chat/constants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSettingsPage } from "../hooks/useSettingsPage";
import { useAuth } from "@/features/auth/hooks/useAuth";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"preferences" | "capabilities" | "account">("preferences");
  const {
    config,
    loaded,
    features,
    skills,
    groupedModels,
    saved,
    handleSave,
    handleModeChange,
    handleModelChange,
    handleFeatureToggle,
    handleSkillToggle,
    resetConfig,
  } = useSettingsPage();
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const tabs = [
    { id: "preferences", label: "Preferences", icon: Sliders },
    { id: "capabilities", label: "Capabilities & Skills", icon: Zap },
    { id: "account", label: "Account & Security", icon: User },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Settings Modal Window */}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 p-6 md:p-8 text-zinc-900 dark:text-zinc-100 shadow-2xl backdrop-blur-2xl transition-all duration-300 max-h-[85vh] flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display tracking-tight">
                Agent Settings
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage default intelligence models, harness tools, and profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetConfig}
              className="p-2 text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
              title="Reset to defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Saved Success Toast Badge */}
        {saved && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2 shrink-0 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>Settings successfully updated and saved!</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-4 border-b border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer",
                  active
                    ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5 font-bold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 min-h-0">
          {!loaded ? (
            <div className="text-center py-10 text-xs text-zinc-400">Loading settings...</div>
          ) : activeTab === "preferences" ? (
            <>
              {/* Execution Strategy Mode */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Default Execution Strategy
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([CHAT_MODES.STANDARD, CHAT_MODES.AGENT] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleModeChange(value)}
                      className={cn(
                        "p-4 rounded-2xl text-left border transition-all text-xs font-medium flex flex-col gap-1 cursor-pointer",
                        config.defaultMode === value
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex items-center justify-between font-bold capitalize text-sm">
                        <span>{value === "standard" ? "Standard Stream" : "Deeper Research"}</span>
                        {config.defaultMode === value && (
                          <Badge variant="success" className="text-[10px]">Active</Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                        {value === "standard"
                          ? "Direct model completion streaming."
                          : "Multi-step iterative agent execution harness."}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Model Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Default Model
                </label>
                <select
                  value={config.defaultModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50"
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
              </div>
            </>
          ) : activeTab === "capabilities" ? (
            <>
              {/* Harness Capabilities */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Harness Tool Capabilities
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((f) => (
                    <label
                      key={f.id}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-700",
                        f.locked && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={config.defaultFeatures.includes(f.id)}
                        disabled={f.locked}
                        onChange={() => handleFeatureToggle(f.id)}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-purple-600 focus:ring-0 w-4 h-4 mt-0.5"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate">
                          {f.name}
                          {f.locked && <Badge variant="warning" className="text-[9px]">PRO</Badge>}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                          {f.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                  Autoloaded Agent Skills
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {skills.map((s) => (
                    <label
                      key={s.name}
                      className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={config.defaultSkills.includes(s.name)}
                        onChange={() => handleSkillToggle(s.name)}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-purple-600 focus:ring-0 w-4 h-4 mt-0.5"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {s.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                          {s.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Account & Security Profile */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {user?.email ? user.email[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {user?.email || "Guest Account"}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Role: <span className="font-semibold text-purple-500 uppercase">{user?.role || "User"}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Link
                  href="/admin/api-keys"
                  onClick={onClose}
                  className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 hover:border-purple-500/40 transition-all flex items-center gap-3"
                >
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-900 dark:text-white">Developer API Keys</h5>
                    <p className="text-[11px] text-zinc-400">Manage credentials & scopes</p>
                  </div>
                </Link>

                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all flex items-center gap-3 text-left cursor-pointer"
                >
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-red-500">Sign Out</h5>
                    <p className="text-[11px] text-red-400/70">Terminate active session</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-end gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await handleSave();
            }}
            className="gap-2 text-xs font-semibold shadow-md"
          >
            <Save className="h-4 w-4" />
            <span>Save Preferences</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
