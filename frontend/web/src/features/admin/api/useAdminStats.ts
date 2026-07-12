"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { AdminStats } from "../types";

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    refetchInterval: 10000, // Refresh every 10s for dynamic dashboard overview
  });
}
