import type { Context, Next } from "hono";
import { MONITOR_CONSTANTS } from "../../../shared/constants/middleware";
import type { JsonObject, JsonValue } from "../../../shared/types";
import { logger } from "../../../shared/utils/logger";

const SENSITIVE_KEY_PATTERN = /api_key|apikey|credentials|secret|token|password/i;

function isPlainObject<T>(val: T): val is T & JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function redactSensitiveValues(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (isPlainObject(value)) {
    const result: JsonObject = {};

    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSensitiveValues(entry);
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
