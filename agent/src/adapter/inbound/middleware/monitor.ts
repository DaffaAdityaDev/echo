import type { Context, Next } from "hono";
import { MONITOR_CONSTANTS } from "../../../shared/constants/middleware";
import type { JsonObject, JsonValue } from "../../../shared/types";
import { logger } from "../../../shared/utils/logger";

// "headers" covers REST-tool header maps, whose auth header names are arbitrary.
const SENSITIVE_KEY_PATTERN = /api[-_]?key|authorization|cookie|credential|secret|token|password|bearer|headers/i;
const AUTH_SCHEME_VALUE_PATTERN = /^\s*(bearer|basic)\s+/i;
const PROMPT_CONTENT_KEYS = new Set(["prompt", "message", "prompt_template"]);
const REDACTED = "[REDACTED]";

function isPlainObject<T>(val: T): val is T & JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function summarizeEntry(key: string, entry: JsonValue): JsonValue {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;

  if (PROMPT_CONTENT_KEYS.has(key.toLowerCase()) && typeof entry === "string") {
    return `[${entry.length} chars]`;
  }

  return redactSensitiveValues(entry);
}

export function redactSensitiveValues(value: JsonValue): JsonValue {
  if (typeof value === "string" && AUTH_SCHEME_VALUE_PATTERN.test(value)) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (isPlainObject(value)) {
    const result: JsonObject = {};

    for (const [key, entry] of Object.entries(value)) {
      result[key] = summarizeEntry(key, entry);
    }

    return result;
  }

  return value;
}

export async function monitorMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.req.header(MONITOR_CONSTANTS.HEADER_REQUEST_ID) || crypto.randomUUID();
  const traceparent = c.req.header(MONITOR_CONSTANTS.HEADER_TRACEPARENT) || MONITOR_CONSTANTS.DEFAULT_TRACEPARENT;
  const shortId = requestId.slice(0, 8);

  let bodySummary: JsonObject | undefined;

  if (method === MONITOR_CONSTANTS.METHOD_POST || method === MONITOR_CONSTANTS.METHOD_PUT) {
    try {
      const clonedReq = c.req.raw.clone();
      const bodyText = await clonedReq.text();

      if (bodyText) {
        const parsed: unknown = JSON.parse(bodyText);

        if (isPlainObject(parsed)) {
          const rest: JsonObject = { ...parsed };
          delete rest.history;
          bodySummary = rest;
        }
      }
    } catch (err) {
      logger.debug(
        `Request body summarization failed [${method} ${path}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      bodySummary = { error: MONITOR_CONSTANTS.BODY_ERROR_SUMMARY };
    }
  }

  logger.info(`--> ${method} ${path} [${shortId}]`, {
    method,
    path,
    traceparent,
    payload: bodySummary ? redactSensitiveValues(bodySummary) : undefined,
  });

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  const logMeta = {
    method,
    path,
    status,
    durationMs: duration,
    requestId,
  };

  const statusMsg = `${status} ${status >= 400 ? MONITOR_CONSTANTS.STATUS_ERR : MONITOR_CONSTANTS.STATUS_OK}`;

  if (status >= 400) {
    logger.error(`<-- ${statusMsg} | ${method} ${path} | ${duration}ms [${shortId}]`, logMeta);
  } else {
    logger.info(`<-- ${statusMsg} | ${method} ${path} | ${duration}ms [${shortId}]`, logMeta);
  }
}
