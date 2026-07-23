"use client";

import { useAdminDashboardPage, AdminDashboardPage } from "@/features/admin";

export default function AdminRoute() {
  const admin = useAdminDashboardPage();
  return <AdminDashboardPage {...admin} />;
}
