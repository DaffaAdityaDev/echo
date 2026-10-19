"use client";

import { useMaturityModel } from "./useMaturityModel";

// Maturity data is computed client-side; the backend exposes no maturity
// endpoints, so client diagnostics are not persisted.
export function useMaturityPage() {
  return useMaturityModel();
}
