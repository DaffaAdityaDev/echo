"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ApiKey } from "../types";

export function useApiKeys() {
  const queryClient = useQueryClient();

  const keysQuery = useQuery<ApiKey[]>({
    queryKey: ["admin", "api-keys"],
    queryFn: () => api.get<ApiKey[]>("/admin/api-keys"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; scopes: string[] }) => {
      const res = await api.post<{ key: string; api_key: ApiKey }>("/admin/api-keys", data);
      return { ...res.api_key, key: res.key };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
  });

  return {
    keys: keysQuery.data || [],
    isLoading: keysQuery.isLoading,
    error: keysQuery.error,
    createKey: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createdKey: createMutation.data,
    resetCreate: createMutation.reset,
    revokeKey: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  };
}
