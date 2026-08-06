import { api } from "@/lib/api-client";
import type { AgentFeature } from "../hooks/useFeatures";

export const featuresApi = {
  list: async (): Promise<AgentFeature[]> => {
    const data = await api.get<AgentFeature[] | { features: AgentFeature[] }>("/features");
    if (Array.isArray(data)) return data;
    return data.features ?? [];
  },
};
