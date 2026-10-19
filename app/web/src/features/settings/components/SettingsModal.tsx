"use client";

import { Key, RotateCcw, Save, Shield, Sliders, User, Zap } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs, tabElementId } from "@/components/ui/Tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useSettingsPage } from "../hooks/useSettingsPage";
import { AccountTab } from "./tabs/AccountTab";
import { ApiKeysTab } from "./tabs/ApiKeysTab";
import { CapabilitiesTab } from "./tabs/CapabilitiesTab";
import { HarnessTab } from "./tabs/HarnessTab";
import { PreferencesTab } from "./tabs/PreferencesTab";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTabId = "preferences" | "capabilities" | "harness" | "api_keys" | "account";

const SETTINGS_TABS = [
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "capabilities", label: "Capabilities & Skills", icon: Zap },
  { id: "harness", label: "Harness Toggles", icon: Shield },
  { id: "api_keys", label: "API Keys", icon: Key },
  { id: "account", label: "Account & Security", icon: User },
] as const satisfies readonly { id: SettingsTabId; label: string; icon: typeof Sliders }[];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("preferences");
  const panelId = useId();
  const { config, loaded, features, skills, groupedModels, handleSave, setConfig, resetConfig } = useSettingsPage();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const save = async () => {
    const ok = await handleSave();
    showToast(ok ? "Settings successfully updated and saved!" : "Failed to save settings", ok ? "success" : "error");
  };

  const renderActiveTab = () => {
    if (!loaded) {
      return (
        <p role="status" className="text-center py-10 text-xs text-muted">
          Loading settings...
        </p>
      );
    }

    switch (activeTab) {
      case "preferences":
        return <PreferencesTab config={config} setConfig={setConfig} groupedModels={groupedModels} />;
      case "capabilities":
        return <CapabilitiesTab config={config} features={features} skills={skills} setConfig={setConfig} />;
      case "harness":
        return <HarnessTab config={config} setConfig={setConfig} />;
      case "api_keys":
        return <ApiKeysTab />;
      case "account":
        return <AccountTab user={user} logout={logout} onClose={onClose} />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agent Settings"
      description="Manage default intelligence models, harness tools, API keys, and profile."
      className="max-w-2xl max-h-[85vh]"
      bodyClassName="flex flex-col overflow-hidden pt-0 flex-1"
      headerActions={
        <button
          type="button"
          onClick={resetConfig}
          className="p-2 rounded-sm text-xs font-semibold text-muted hover:text-danger transition-colors flex items-center gap-1.5 cursor-pointer"
          aria-label="Reset settings to defaults"
          title="Reset to defaults"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Reset
          </span>
        </button>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={save} className="gap-2 text-xs font-semibold shadow-md">
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>Save Preferences</span>
          </Button>
        </>
      }
    >
      <div className="pt-4 border-b border-border shrink-0 overflow-x-auto">
        <Tabs
          tabs={SETTINGS_TABS}
          active={activeTab}
          onChange={setActiveTab}
          ariaLabel="Settings sections"
          panelId={panelId}
          className="min-w-max"
          itemClassName="px-3.5 py-2.5 rounded-t-sm whitespace-nowrap"
        />
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabElementId(panelId, activeTab)}
        className="flex-1 overflow-y-auto py-5 space-y-6 min-h-0"
      >
        {renderActiveTab()}
      </div>
    </Modal>
  );
}
