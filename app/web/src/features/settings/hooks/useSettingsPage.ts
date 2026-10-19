"use client";

import { useEffect, useState } from "react";
import { useModels } from "@/features/chat/hooks/useModels";
import { useFeatures } from "@/features/shared/hooks/useFeatures";
import { useSkills } from "@/features/shared/hooks/useSkills";
import { settingsApi } from "../services/settings-api";
import { useSettingsStore } from "../stores/settingsStore";
import { type AgentConfig, DEFAULT_AGENT_CONFIG } from "../types";

export function useSettingsPage() {
  const loaded = useSettingsStore((s) => s.loaded);
  const commitConfig = useSettingsStore((s) => s.setConfig);
  const hydrate = useSettingsStore((s) => s.hydrate);
  // Edits stay in a draft until Save so Cancel discards them.
  const [config, setDraft] = useState<AgentConfig>(() => useSettingsStore.getState().config);

  const { features } = useFeatures();
  const { skills } = useSkills();
  const { models } = useModels();

  useEffect(() => {
    void hydrate().then(() => setDraft(useSettingsStore.getState().config));
  }, [hydrate]);

  const setConfig = (partial: Partial<AgentConfig>) => setDraft((prev) => ({ ...prev, ...partial }));

  const resetConfig = () =>
    setDraft((prev) => ({ ...DEFAULT_AGENT_CONFIG, hasApiKey: prev.hasApiKey }));

  const handleSave = async () => {
    try {
      const savedConfig = await settingsApi.update(config);
      commitConfig(savedConfig);
      setDraft(savedConfig);

      return true;
    } catch (err) {
      console.warn("[Settings] Failed to save settings:", err);

      return false;
    }
  };

  const groupedModels = models.reduce<Record<string, typeof models>>((acc, m) => {
    const group = acc[m.provider_name] ?? [];
    acc[m.provider_name] = [...group, m];

    return acc;
  }, {});

  return {
    config,
    loaded,
    features,
    skills,
    groupedModels,
    handleSave,
    setConfig,
    resetConfig,
  };
}
