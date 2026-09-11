import { api } from "@/lib/api-client";

import type { ApiKey, CreateApiKeyRequest, CreateApiKeyResponse } from "../types/apiKey";

export const apiKeyService = {
  list: async (): Promise<ApiKey[]> => {
    return api.get<ApiKey[]>("/api-keys");
  },

  create: async (req: CreateApiKeyRequest): Promise<CreateApiKeyResponse> => {
    return api.post<CreateApiKeyResponse>("/api-keys", req);
  },

  revoke: async (id: string): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(`/api-keys/${id}`);
  },
};
