"use client";

import { useCallback } from "react";
import { settingsApi } from "@/features/settings/services/settings-api";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import type { AgentConfig } from "@/features/settings/types";
import { useToast } from "@/hooks/useToast";

export function usePersistAgentConfig() {
  const { showToast } = useToast();

  const persistConfig = useCallback(
    async (partial: Partial<AgentConfig>) => {
      const merged = { ...useSettingsStore.getState().config, ...partial };
      useSettingsStore.getState().setConfig(partial);
      try {
        await settingsApi.update(merged);
      } catch {
        showToast("Failed to save preference — the change may not persist.", "error");
      }
    },
    [showToast],
  );

  return persistConfig;
}
