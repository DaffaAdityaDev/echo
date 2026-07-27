"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettingsStore } from "../stores/settingsStore";
import { useFeatures } from "@/features/shared/hooks/useFeatures";
import { useSkills } from "@/features/shared/hooks/useSkills";
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

  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (serverConfig) {
      setConfig(serverConfig);
    }
  }, [serverConfig, setConfig]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleSave = async () => {
    try {
      const savedConfig = await settingsApi.update(config);
      setConfig(savedConfig);
      setSaved(true);
      return true;
    } catch (err) {
      console.warn("[Settings] Failed to save settings:", err);
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

  const handleProviderTypeChange = useCallback((value: string) => {
    setConfig({ providerType: value });
  }, [setConfig]);

  const handleApiKeyChange = useCallback((value: string) => {
    setConfig({ apiKey: value });
  }, [setConfig]);

  const handleBaseUrlChange = useCallback((value: string) => {
    setConfig({ baseUrl: value });
  }, [setConfig]);

  const groupedModels = models.reduce<Record<string, typeof models>>((acc, m) => {
    (acc[m.provider_name] ??= []).push(m);
    return acc;
  }, {});

  return {
    config,
    loaded: loadedStore && !isLoading,
    features,
    skills,
    groupedModels,
    saved,
    loading: isLoading,
    handleSave,
    handleModeChange,
    handleModelChange,
    handleFeatureToggle,
    handleSkillToggle,
    handleProviderTypeChange,
    handleApiKeyChange,
    handleBaseUrlChange,
    setConfig,
    resetConfig,
  };
}
