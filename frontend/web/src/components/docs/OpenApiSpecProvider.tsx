"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { normalizeSpec } from "@/lib/docs/normalize";
import type { NormalizedSpec } from "@/lib/docs/types";

interface SpecContextValue {
  spec: NormalizedSpec | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const SpecContext = createContext<SpecContextValue>({
  spec: null,
  loading: true,
  error: null,
  refresh: () => {},
});

export function useSpec() {
  return useContext(SpecContext);
}

export function OpenApiSpecProvider({ children }: { children: React.ReactNode }) {
  const [spec, setSpec] = useState<NormalizedSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpec = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/docs/spec");
      if (!res.ok) throw new Error(`Failed to load spec: ${res.statusText}`);
      const raw = await res.json();
      setSpec(normalizeSpec(raw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpec();
  }, [fetchSpec]);

  return <SpecContext.Provider value={{ spec, loading, error, refresh: fetchSpec }}>{children}</SpecContext.Provider>;
}
