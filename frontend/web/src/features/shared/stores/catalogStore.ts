import { create } from "zustand";
import type { Model } from "@/lib/queries";
import type { AgentFeature } from "../hooks/useFeatures";
import type { AgentSkill } from "../hooks/useSkills";

interface CatalogState {
  features: AgentFeature[];
  skills: AgentSkill[];
  models: Model[];
  setFeatures: (features: AgentFeature[]) => void;
  setSkills: (skills: AgentSkill[]) => void;
  setModels: (models: Model[]) => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  features: [],
  skills: [],
  models: [],
  setFeatures: (features) => set({ features }),
  setSkills: (skills) => set({ skills }),
  setModels: (models) => set({ models }),
}));
