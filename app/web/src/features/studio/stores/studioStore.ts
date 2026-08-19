import { create } from "zustand";
import type { PromptTemplate, SystemMaturityAssessment } from "../types";

interface StudioState {
  prompts: PromptTemplate[];
  maturity: SystemMaturityAssessment | null;
  setPrompts: (prompts: PromptTemplate[]) => void;
  setMaturity: (maturity: SystemMaturityAssessment | null) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  prompts: [],
  maturity: null,
  setPrompts: (prompts) => set({ prompts }),
  setMaturity: (maturity) => set({ maturity }),
}));
