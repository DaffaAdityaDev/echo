import { Context, Next } from "hono";
import { logger } from "../../shared/utils/logger";
import { MONITOR_CONSTANTS } from "../../shared/constants/middleware";

export async function monitorMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.req.header(MONITOR_CONSTANTS.HEADER_REQUEST_ID) || crypto.randomUUID();
  const traceparent = c.req.header(MONITOR_CONSTANTS.HEADER_TRACEPARENT) || MONITOR_CONSTANTS.DEFAULT_TRACEPARENT;
  const shortId = requestId.slice(0, 8);

  // Attempt to clone and parse the body for diagnostic logging
  let bodySummary: any = undefined;
  if (method === MONITOR_CONSTANTS.METHOD_POST || method === MONITOR_CONSTANTS.METHOD_PUT) {
    try {
      const clonedReq = c.req.raw.clone();
      const bodyText = await clonedReq.text();
      if (bodyText) {
        const parsed = JSON.parse(bodyText);
        // Exclude large fields like prompt history from brief console logs
        const { history, ...rest } = parsed;
        bodySummary = rest;
      }
    } catch (err) {
      bodySummary = { error: MONITOR_CONSTANTS.BODY_ERROR_SUMMARY };
    }
  }

  logger.info(`--> ${method} ${path} [${shortId}]`, {
    method,
    path,
    traceparent,
    payload: bodySummary
  });

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  const logMeta = {
    method,
    path,
    status,
    durationMs: duration,
    requestId
  };

  const statusMsg = `${status} ${status >= 400 ? MONITOR_CONSTANTS.STATUS_ERR : MONITOR_CONSTANTS.STATUS_OK}`;
  if (status >= 400) {
    logger.error(`<-- ${statusMsg} | ${method} ${path} | ${duration}ms [${shortId}]`, logMeta);
  } else {
    logger.info(`<-- ${statusMsg} | ${method} ${path} | ${duration}ms [${shortId}]`, logMeta);
  }
}
