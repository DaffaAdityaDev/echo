"use client";

import { useState } from "react";
import { useApiKeys } from "../api/useApiKeys";

export function useAdminApiKeysPage() {
  const apiKeys = useApiKeys();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateSubmit = async (data: { name: string; scopes: string[] }) => {
    await apiKeys.createKey(data);
    setIsModalOpen(false);
  };

  const handleCloseDisplay = () => {
    apiKeys.resetCreate();
  };

  return {
    ...apiKeys,
    isModalOpen,
    setIsModalOpen,
    handleCreateSubmit,
    handleCloseDisplay,
  };
}
