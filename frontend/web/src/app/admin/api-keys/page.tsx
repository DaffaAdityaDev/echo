"use client";

import { useAdminApiKeysPage, AdminApiKeysPage } from "@/features/admin";

export default function ApiKeysRoute() {
  const apiKeys = useAdminApiKeysPage();
  return <AdminApiKeysPage {...apiKeys} />;
}
