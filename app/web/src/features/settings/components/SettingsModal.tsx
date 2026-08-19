"use client";

import { RotateCcw, Save, Shield, Sliders, User, X, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useSettingsPage } from "../hooks/useSettingsPage";
import { AccountTab } from "./tabs/AccountTab";
import { CapabilitiesTab } from "./tabs/CapabilitiesTab";
import { HarnessTab } from "./tabs/HarnessTab";
import { PreferencesTab } from "./tabs/PreferencesTab";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"preferences" | "capabilities" | "harness" | "account">("preferences");
  const { config, loaded, features, skills, groupedModels, handleSave, setConfig, resetConfig } = useSettingsPage();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  if (!isOpen) return null;

  const tabs = [
    { id: "preferences", label: "Preferences", icon: Sliders },
    { id: "capabilities", label: "Capabilities & Skills", icon: Zap },
    { id: "harness", label: "Harness Toggles", icon: Shield },
    { id: "account", label: "Account & Security", icon: User },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close settings"
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in cursor-pointer"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 p-6 md:p-8 text-zinc-900 dark:text-zinc-100 shadow-2xl backdrop-blur-2xl transition-all duration-300 max-h-[85vh] flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display tracking-tight">Agent Settings</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage default intelligence models, harness tools, and profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConfig}
              className="p-2 text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
              title="Reset to defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="pt-4 border-b border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} itemClassName="px-3.5 py-2.5 rounded-t-xl" />
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 min-h-0">
          {!loaded ? (
            <div className="text-center py-10 text-xs text-zinc-400">Loading settings...</div>
          ) : activeTab === "preferences" ? (
            <PreferencesTab config={config} setConfig={setConfig} groupedModels={groupedModels} />
          ) : activeTab === "capabilities" ? (
            <CapabilitiesTab config={config} features={features} skills={skills} setConfig={setConfig} />
          ) : activeTab === "harness" ? (
            <HarnessTab config={config} setConfig={setConfig} />
          ) : (
            <AccountTab user={user} logout={logout} onClose={onClose} />
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-end gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              const ok = await handleSave();
              showToast(
                ok ? "Settings successfully updated and saved!" : "Failed to save settings",
                ok ? "success" : "error",
              );
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
