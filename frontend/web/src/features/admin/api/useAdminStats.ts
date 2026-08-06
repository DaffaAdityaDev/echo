"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { adminApi } from "../services/admin-api";
import { useAdminStore } from "../stores/adminStore";
import type { AdminStats } from "../types";

export function useAdminStats() {
  const setStats = useAdminStore((s) => s.setStats);
  const query = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: adminApi.getStats,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (query.data) {
      setStats(query.data);
    }
  }, [query.data, setStats]);

  return query;
}
