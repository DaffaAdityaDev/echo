export * from "./api";
export * from "./query-keys";

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
