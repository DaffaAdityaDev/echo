"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { adminApi } from "../services/admin-api";
import { useAdminStore } from "../stores/adminStore";
import type { ApiKey } from "../types";

export function useApiKeys() {
  const queryClient = useQueryClient();
  const setApiKeys = useAdminStore((s) => s.setApiKeys);

  const keysQuery = useQuery<ApiKey[]>({
    queryKey: ["admin", "api-keys"],
    queryFn: adminApi.listApiKeys,
  });

  useEffect(() => {
    if (keysQuery.data) {
      setApiKeys(keysQuery.data);
    }
  }, [keysQuery.data, setApiKeys]);

  const createMutation = useMutation({
    mutationFn: adminApi.createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: adminApi.revokeApiKey,
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
