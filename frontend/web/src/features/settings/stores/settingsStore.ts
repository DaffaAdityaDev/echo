import { create } from "zustand";
import { getStorageJSON, removeStorage, setStorageJSON } from "@/utils/storage";
import { settingsApi } from "../services/settings-api";
import { type AgentConfig, DEFAULT_AGENT_CONFIG } from "../types";

const STORAGE_KEY = "echo_agent_config";

function loadConfig(): AgentConfig {
  const stored = getStorageJSON<Partial<AgentConfig>>(STORAGE_KEY);
  return stored ? { ...DEFAULT_AGENT_CONFIG, ...stored } : DEFAULT_AGENT_CONFIG;
}

interface SettingsState {
  config: AgentConfig;
  loaded: boolean;
  mutations: number;
  setConfig: (partial: Partial<AgentConfig>) => void;
  resetConfig: () => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: loadConfig(),
  loaded: false,
  mutations: 0,
  setConfig: (partial) =>
    set((state) => {
      const next = { ...state.config, ...partial };
      // The backend stores the key encrypted and only re-exposes hasApiKey;
      // never persist the plaintext key — memory only.
      setStorageJSON(STORAGE_KEY, { ...next, apiKey: undefined });
      return { config: next, mutations: state.mutations + 1 };
    }),
  resetConfig: () => {
    removeStorage(STORAGE_KEY);
    set({ config: DEFAULT_AGENT_CONFIG });
  },
  hydrate: async () => {
    set({ loaded: false });
    try {
      const mutationsBefore = get().mutations;
      const serverConfig = await settingsApi.get();
      // Skip if the user changed config while the request was in flight —
      // the server response may predate the newer local mutation.
      if (get().mutations === mutationsBefore) {
        get().setConfig(serverConfig);
      }
    } catch (err) {
      console.warn("[Settings] Failed to hydrate config from server:", err);
    } finally {
      set({ loaded: true });
    }
  },
}));
