import type { Context, Next } from "hono";
import { ENV } from "../../../config/env";
import { ERROR_STATUS } from "../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../shared/constants/http";
import { AUTH_CONSTANTS } from "../../../shared/constants/middleware";
import { logger } from "../../../shared/utils/logger";

export async function authMiddleware(c: Context, next: Next) {
  if (
    c.req.path === AUTH_CONSTANTS.BYPASS_PATH ||
    c.req.path.startsWith("/api/docs") ||
    c.req.path.startsWith("/docs")
  ) {
    return await next();
  }

  const tokenToUse = ENV.INTERNAL_AUTH_TOKEN;
  const authHeader = c.req.header(AUTH_CONSTANTS.HEADER_AUTHORIZATION);
  const xInternalHeader = c.req.header(AUTH_CONSTANTS.HEADER_INTERNAL_TOKEN);

  let receivedToken = "";
  if (authHeader?.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
    receivedToken = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX.length);
  } else if (xInternalHeader) {
    receivedToken = xInternalHeader;
  }

  if (!receivedToken || receivedToken !== tokenToUse) {
    logger.warn(
      `Unauthorized access attempt to Agent endpoint: ${c.req.path} from IP: ${c.req.header(AUTH_CONSTANTS.HEADER_FORWARDED_FOR) || AUTH_CONSTANTS.DEFAULT_IP}`,
    );
    return c.json(
      {
        status: ERROR_STATUS,
        message: AUTH_CONSTANTS.FORBIDDEN_MESSAGE,
      },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  await next();
}
