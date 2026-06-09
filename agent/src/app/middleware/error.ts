import { Context } from "hono";
import { AppError } from "../../shared/utils/errors";
import { logger } from "../../shared/utils/logger";

export function errorHandler(err: Error, c: Context) {
  const requestId = c.req.header("x-request-id") || "unknown";
  
  // 1. Check for custom AppError
  if (err instanceof AppError) {
    logger.warn(`AppError handled [Request: ${requestId}]: ${err.message}`, { statusCode: err.statusCode, details: err.errors });
    return c.json({
      status: "error",
      error_type: "APPLICATION_ERROR",
      message: err.message,
      ...(err.errors && { details: err.errors })
    }, err.statusCode as any);
  }

  // 2. Handle LLM Provider Rate Limits (429) or timeouts (504/408)
  const errMsg = err.message || "";
  if (errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("RateLimit")) {
    logger.error(`LLM Rate Limit encountered [Request: ${requestId}]: ${errMsg}`);
    return c.json({
      status: "error",
      error_type: "RATE_LIMIT_ERROR",
      message: "Upstream LLM Provider API rate limit exceeded. Please retry shortly."
    }, 429);
  }

  if (errMsg.includes("timeout") || errMsg.includes("deadline") || errMsg.includes("504") || errMsg.includes("408")) {
    logger.error(`Upstream timeout encountered [Request: ${requestId}]: ${errMsg}`);
    return c.json({
      status: "error",
      error_type: "TIMEOUT_ERROR",
      message: "Upstream LLM Provider query timed out. Please retry."
    }, 504);
  }

  // 3. Handle bad client payload / JSON parsing errors
  if (err instanceof SyntaxError && errMsg.includes("JSON")) {
    logger.warn(`Invalid JSON payload submitted [Request: ${requestId}]: ${errMsg}`);
    return c.json({
      status: "error",
      error_type: "BAD_REQUEST",
      message: "Malformed request payload body. Ensure valid JSON structure is supplied."
    }, 400);
  }

  // 4. Default fallback: Unhandled System Error
  logger.error(`Unhandled system exception caught [Request: ${requestId}]`, err);
  return c.json({
    status: "error",
    error_type: "INTERNAL_SERVER_ERROR",
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message
  }, 500);
}
