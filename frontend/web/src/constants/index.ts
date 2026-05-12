export * from "./api";
export * from "./query-keys";

export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  TIMEOUT: 15000,
};

export const APP_CONFIG = {
  NAME: "ECHO Brain",
  VERSION: "1.0.0",
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: "echo_auth_token",
  CHAT_HISTORY: "echo_chat_history",
  THEME: "echo_theme",
};

export const QUERY_CONFIG = {
  STALE_TIME: 60 * 1000,
  STATUS: {
    PENDING: "pending",
    SUCCESS: "success",
    ERROR: "error",
  },
} as const;

export const UI_CONFIG = {
  SCROLL_BEHAVIOR: "smooth" as ScrollBehavior,
};
