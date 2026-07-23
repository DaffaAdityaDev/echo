"use client";

import { useAdminStats } from "../api/useAdminStats";

export function useAdminDashboardPage() {
  const statsQuery = useAdminStats();

  return {
    stats: statsQuery.data ?? null,
    isLoading: statsQuery.isLoading,
    isRefetching: statsQuery.isFetching && !statsQuery.isLoading,
    error: (statsQuery.error as Error) ?? null,
    onRefresh: () => {
      statsQuery.refetch();
    },
    dataUpdatedAt: statsQuery.dataUpdatedAt,
  };
}
