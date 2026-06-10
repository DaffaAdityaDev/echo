export const AUTH_CONSTANTS = {
  BYPASS_PATH: "/",
  HEADER_AUTHORIZATION: "Authorization",
  HEADER_INTERNAL_TOKEN: "X-Internal-Token",
  HEADER_FORWARDED_FOR: "x-forwarded-for",
  BEARER_PREFIX: "Bearer ",
  DEFAULT_IP: "unknown",
  FORBIDDEN_MESSAGE: "Forbidden: Invalid or missing internal token authentication credentials.",
} as const;

export const MONITOR_CONSTANTS = {
  HEADER_REQUEST_ID: "x-request-id",
  HEADER_TRACEPARENT: "traceparent",
  DEFAULT_TRACEPARENT: "none",
  METHOD_POST: "POST",
  METHOD_PUT: "PUT",
  BODY_ERROR_SUMMARY: "Unparsed/Large Body",
  STATUS_OK: "OK",
  STATUS_ERR: "ERR",
} as const;
