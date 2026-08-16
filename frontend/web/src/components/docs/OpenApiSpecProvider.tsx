"use client";

import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { createContext, useContext } from "react";
import { specQueries } from "@/lib/queries";
import type { NormalizedSpec } from "@/lib/docs/types";
import { extractErrorMessage } from "@/utils/error";

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
  const { data: spec, isPending, isError, error, refetch } = useQuery(specQueries.fetch());

  return (
    <SpecContext.Provider
      value={{
        spec: spec ?? null,
        loading: isPending,
        error: isError ? extractErrorMessage(error, "Unknown error") : null,
        refresh: () => {
          void refetch();
        },
      }}
    >
      {children}
    </SpecContext.Provider>
  );
}
