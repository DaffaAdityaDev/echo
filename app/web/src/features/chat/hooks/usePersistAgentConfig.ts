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
      const store = useSettingsStore.getState();
      const hydrated = await store.ensureHydrated();
      store.setConfig(partial);

      // Without the server's settings the local config holds defaults, and
      // persisting it would overwrite the user's saved preferences.
      if (!hydrated) {
        showToast("Failed to load saved settings — the change was not persisted.", "error");

        return;
      }

      try {
        await settingsApi.update(useSettingsStore.getState().config);
      } catch {
        showToast("Failed to save preference — the change may not persist.", "error");
      }
    },
    [showToast],
  );

  return persistConfig;
}
