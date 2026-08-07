import { create } from "zustand";
import { getStorageJSON, removeStorage, setStorageJSON } from "@/utils/storage";
import { type AgentConfig, DEFAULT_AGENT_CONFIG } from "../types";

const STORAGE_KEY = "echo_agent_config";

function loadConfig(): AgentConfig {
  const stored = getStorageJSON<Partial<AgentConfig>>(STORAGE_KEY);
  return stored ? { ...DEFAULT_AGENT_CONFIG, ...stored } : DEFAULT_AGENT_CONFIG;
}

interface SettingsState {
  config: AgentConfig;
  loaded: boolean;
  setConfig: (partial: Partial<AgentConfig>) => void;
  resetConfig: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: loadConfig(),
  loaded: true,
  setConfig: (partial) =>
    set((state) => {
      const next = { ...state.config, ...partial };
      setStorageJSON(STORAGE_KEY, next);
      return { config: next };
    }),
  resetConfig: () => {
    removeStorage(STORAGE_KEY);
    set({ config: DEFAULT_AGENT_CONFIG });
  },
}));
