"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useFeatures } from "@/features/chat/hooks/useFeatures";
import { useSkills } from "@/features/chat/hooks/useSkills";
import { useModels } from "@/features/chat/hooks/useModels";
import { settingsApi } from "../services/settings-api";

export function useSettingsPage() {
  const config = useSettingsStore((s) => s.config);
  const loadedStore = useSettingsStore((s) => s.loaded);
  const setConfig = useSettingsStore((s) => s.setConfig);
  const resetConfig = useSettingsStore((s) => s.resetConfig);

  const { features } = useFeatures();
  const { skills } = useSkills();
  const { models } = useModels();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get()
      .then((serverConfig) => {
        setConfig(serverConfig);
      })
      .catch(() => {
        // fallback to localStorage defaults
      })
      .finally(() => setLoading(false));
  }, [setConfig]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleSave = async () => {
    try {
      await settingsApi.update(config);
      setSaved(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleModeChange = useCallback((value: string) => {
    setConfig({ defaultMode: value });
  }, [setConfig]);

  const handleModelChange = useCallback((value: string) => {
    setConfig({ defaultModel: value });
  }, [setConfig]);

  const handleFeatureToggle = useCallback((id: string) => {
    const next = config.defaultFeatures.includes(id)
      ? config.defaultFeatures.filter((f) => f !== id)
      : [...config.defaultFeatures, id];
    setConfig({ defaultFeatures: next });
  }, [config.defaultFeatures, setConfig]);

  const handleSkillToggle = useCallback((name: string) => {
    const next = config.defaultSkills.includes(name)
      ? config.defaultSkills.filter((s) => s !== name)
      : [...config.defaultSkills, name];
    setConfig({ defaultSkills: next });
  }, [config.defaultSkills, setConfig]);

  const groupedModels = models.reduce<Record<string, typeof models>>((acc, m) => {
    (acc[m.provider_name] ??= []).push(m);
    return acc;
  }, {});

  return {
    config,
    loaded: loadedStore && !loading,
    features,
    skills,
    models,
    groupedModels,
    saved,
    loading,
    handleSave,
    handleModeChange,
    handleModelChange,
    handleFeatureToggle,
    handleSkillToggle,
    setConfig,
    resetConfig,
  };
}
