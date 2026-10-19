"use client";

import { useCallback, useEffect, useState } from "react";
import { apiKeyService } from "../services/apiKeyService";
import type { ApiKey } from "../types/apiKey";

type LoadStatus = "loading" | "error" | "ready";

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    apiKeyService
      .list()
      .then((data) => {
        if (ignore) return;
        setKeys(data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setStatus("loading");
    setReloadToken((token) => token + 1);
  }, []);

  const create = useCallback(
    async (name: string) => {
      const res = await apiKeyService.create({ name });
      reload();
      return res.key;
    },
    [reload],
  );

  const revoke = useCallback(
    async (id: string) => {
      await apiKeyService.revoke(id);
      reload();
    },
    [reload],
  );

  return { keys, status, reload, create, revoke };
}
