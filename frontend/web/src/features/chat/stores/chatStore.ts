import { create } from "zustand"
import { Message, AgentProgress, Session, AgentState } from "../types"

interface ChatState {
  messages: Message[]
  isLoading: boolean
  agentProgress: AgentProgress | null
  sessions: Session[]
  activeSessionId: string | null
  agentState: AgentState
  selectedModel: string
  mode: string
  selectedFeatures: string[]

  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void
  setIsLoading: (loading: boolean) => void
  setAgentProgress: (updater: AgentProgress | null | ((prev: AgentProgress | null) => AgentProgress | null)) => void
  setSessions: (sessions: Session[]) => void
  setActiveSession: (id: string | null) => void
  setAgentState: (state: AgentState) => void
  clearMessages: () => void
  setSelectedModel: (model: string) => void
  setMode: (mode: string) => void
  setSelectedFeatures: (updater: string[] | ((prev: string[]) => string[])) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  agentProgress: null,
  sessions: [],
  activeSessionId: null,
  agentState: 'completed',
  selectedModel: '',
  mode: 'standard',
  selectedFeatures: [],

  setMessages: (updater) => set((state) => ({
    messages: typeof updater === "function" ? updater(state.messages) : updater,
  })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setAgentProgress: (updater) => set((state) => ({
    agentProgress: typeof updater === "function" ? updater(state.agentProgress) : updater,
  })),
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setAgentState: (agentState) => set({ agentState }),
  clearMessages: () => set({ messages: [], isLoading: false, agentProgress: null }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setMode: (mode) => set({ mode }),
  setSelectedFeatures: (updater) => set((state) => ({
    selectedFeatures: typeof updater === "function" ? updater(state.selectedFeatures) : updater,
  })),
}))
