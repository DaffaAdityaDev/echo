"use client";

import { useAdminDashboardPage } from "@/features/admin/hooks/useAdminDashboardPage";
import { AdminDashboardPage } from "@/features/admin/components/AdminDashboardPage";

export default function AdminRoute() {
  const admin = useAdminDashboardPage();
  return <AdminDashboardPage {...admin} />;
}
