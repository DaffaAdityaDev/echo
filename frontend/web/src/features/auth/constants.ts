export const AUTH_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
} as const;

export const AUTH_QUERY_KEYS = {
  ME: ["auth", "me"],
} as const;
