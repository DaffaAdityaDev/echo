"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useModels } from "@/features/chat/hooks/useModels";
import { useFeatures } from "@/features/shared/hooks/useFeatures";
import { useSkills } from "@/features/shared/hooks/useSkills";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { settingsApi } from "../services/settings-api";
import { useSettingsStore } from "../stores/settingsStore";

export function useSettingsPage() {
  const config = useSettingsStore((s) => s.config);
  const loadedStore = useSettingsStore((s) => s.loaded);
  const setConfig = useSettingsStore((s) => s.setConfig);
  const resetConfig = useSettingsStore((s) => s.resetConfig);

  const { features } = useFeatures();
  const { skills } = useSkills();
  const { models } = useModels();

  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 60_000,
    ...QUERY_STANDARD,
    retry: false,
  });

  useEffect(() => {
    if (serverConfig) {
      setConfig(serverConfig);
    }
  }, [serverConfig, setConfig]);

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
    loaded: loadedStore && !isLoading,
    features,
    skills,
    groupedModels,
    loading: isLoading,
    handleSave,
    setConfig,
    resetConfig,
  };
}
