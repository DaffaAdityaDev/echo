import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ERROR_MESSAGES, ERROR_STATUS, ERROR_TYPES } from "../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../shared/constants/http";
import { AppError } from "../../../shared/utils/errors";
import { logger } from "../../../shared/utils/logger";

export function errorHandler(err: Error, c: Context) {
  const requestId = c.req.header("x-request-id") || "unknown";

  if (err instanceof AppError) {
    logger.warn(`AppError handled [Request: ${requestId}]: ${err.message}`, {
      statusCode: err.statusCode,
      details: err.errors,
    });
    return c.json(
      {
        status: ERROR_STATUS,
        error_type: ERROR_TYPES.APPLICATION_ERROR,
        message: err.message,
        ...(err.errors && { details: err.errors }),
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  const errMsg = err.message || "";
  if (errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("RateLimit")) {
    logger.error(`LLM Rate Limit encountered [Request: ${requestId}]: ${errMsg}`);
    return c.json(
      {
        status: ERROR_STATUS,
        error_type: ERROR_TYPES.RATE_LIMIT,
        message: ERROR_MESSAGES.RATE_LIMIT,
      },
      HTTP_STATUS.TOO_MANY_REQUESTS,
    );
  }

  if (errMsg.includes("timeout") || errMsg.includes("deadline") || errMsg.includes("504") || errMsg.includes("408")) {
    logger.error(`Upstream timeout encountered [Request: ${requestId}]: ${errMsg}`);
    return c.json(
      {
        status: ERROR_STATUS,
        error_type: ERROR_TYPES.TIMEOUT,
        message: ERROR_MESSAGES.TIMEOUT,
      },
      HTTP_STATUS.GATEWAY_TIMEOUT,
    );
  }

  if (err instanceof SyntaxError && errMsg.includes("JSON")) {
    logger.warn(`Invalid JSON payload submitted [Request: ${requestId}]: ${errMsg}`);
    return c.json(
      {
        status: ERROR_STATUS,
        error_type: ERROR_TYPES.BAD_REQUEST,
        message: ERROR_MESSAGES.BAD_REQUEST,
      },
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  logger.error(`Unhandled system exception caught [Request: ${requestId}]`, err);
  return c.json(
    {
      status: "error",
      error_type: ERROR_TYPES.INTERNAL_SERVER,
      message: process.env.NODE_ENV === "production" ? ERROR_MESSAGES.INTERNAL_SERVER : err.message,
    },
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
  );
}
