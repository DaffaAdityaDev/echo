"use client";

import { useEffect } from "react";
import { useModels } from "@/features/chat/hooks/useModels";
import { useFeatures } from "@/features/shared/hooks/useFeatures";
import { useSkills } from "@/features/shared/hooks/useSkills";
import { settingsApi } from "../services/settings-api";
import { useSettingsStore } from "../stores/settingsStore";

export function useSettingsPage() {
  const config = useSettingsStore((s) => s.config);
  const loaded = useSettingsStore((s) => s.loaded);
  const setConfig = useSettingsStore((s) => s.setConfig);
  const resetConfig = useSettingsStore((s) => s.resetConfig);
  const hydrate = useSettingsStore((s) => s.hydrate);

  const { features } = useFeatures();
  const { skills } = useSkills();
  const { models } = useModels();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const handleSave = async () => {
    try {
      const savedConfig = await settingsApi.update(config);
      setConfig(savedConfig);
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
