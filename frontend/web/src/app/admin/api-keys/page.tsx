"use client";

import { useAdminApiKeysPage } from "@/features/admin/hooks/useAdminApiKeysPage";
import { AdminApiKeysPage } from "@/features/admin/components/AdminApiKeysPage";

export default function ApiKeysRoute() {
  const apiKeys = useAdminApiKeysPage();
  return <AdminApiKeysPage {...apiKeys} />;
}
