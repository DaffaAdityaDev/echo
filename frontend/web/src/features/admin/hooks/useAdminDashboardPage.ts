"use client";

import { useAdminStats } from "../api/useAdminStats";

export function useAdminDashboardPage() {
  const statsQuery = useAdminStats();

  return {
    stats: statsQuery.data ?? null,
    isLoading: statsQuery.isLoading,
    error: statsQuery.error,
  };
}
