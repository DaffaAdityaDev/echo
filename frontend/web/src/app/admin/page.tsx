"use client";

import { AdminDashboardPage, useAdminDashboardPage } from "@/features/admin";

export default function AdminRoute() {
  const admin = useAdminDashboardPage();
  return <AdminDashboardPage {...admin} />;
}
