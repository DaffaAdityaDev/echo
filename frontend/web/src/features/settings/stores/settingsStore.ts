import { create } from "zustand"
import { AgentConfig, DEFAULT_AGENT_CONFIG } from "../types"

const STORAGE_KEY = "echo_agent_config"

function loadConfig(): AgentConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(stored) }
    }
  } catch {}
  return DEFAULT_AGENT_CONFIG
}

interface SettingsState {
  config: AgentConfig
  loaded: boolean
  setConfig: (partial: Partial<AgentConfig>) => void
  resetConfig: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: loadConfig(),
  loaded: true,
  setConfig: (partial) => set((state) => {
    const next = { ...state.config, ...partial }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return { config: next }
  }),
  resetConfig: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ config: DEFAULT_AGENT_CONFIG })
  },
}))
