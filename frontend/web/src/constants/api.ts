export const API_VERSION = "v1";

export const ENDPOINTS = {
  MODELS: {
    LIST: "/models",
  },
} as const;

export function getBackendApiUrl(): string {
  const rawUrl = process.env.BACKEND_URL || "http://localhost:8080";
  const trimmed = rawUrl.replace(/\/$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

