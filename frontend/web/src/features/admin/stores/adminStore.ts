import { create } from "zustand";
import type { AdminStats, ApiKey } from "../types";

interface AdminState {
  stats: AdminStats | null;
  apiKeys: ApiKey[];
  setStats: (stats: AdminStats | null) => void;
  setApiKeys: (apiKeys: ApiKey[]) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  stats: null,
  apiKeys: [],
  setStats: (stats) => set({ stats }),
  setApiKeys: (apiKeys) => set({ apiKeys }),
}));
