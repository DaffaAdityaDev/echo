import { api } from "@/lib/api-client";
import type { AdminStats, ApiKey } from "../types";

export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    return api.get<AdminStats>("/admin/stats");
  },

  listApiKeys: async (): Promise<ApiKey[]> => {
    return api.get<ApiKey[]>("/admin/api-keys");
  },

  createApiKey: async (data: { name: string; scopes: string[] }): Promise<ApiKey & { key: string }> => {
    const res = await api.post<{ key: string; api_key: ApiKey }>("/admin/api-keys", data);
    return { ...res.api_key, key: res.key };
  },

  revokeApiKey: async (id: string): Promise<void> => {
    return api.delete<void>(`/admin/api-keys/${id}`);
  },
};
