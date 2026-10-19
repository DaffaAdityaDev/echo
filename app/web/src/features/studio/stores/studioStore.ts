import { create } from "zustand";
import type { PromptTemplate } from "../types";

interface StudioState {
  prompts: PromptTemplate[];
  setPrompts: (prompts: PromptTemplate[]) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  prompts: [],
  setPrompts: (prompts) => set({ prompts }),
}));
