import { Context, Next } from "hono";
import { logger } from "../../shared/utils/logger";
import { ENV } from "../../config/env";
import { AUTH_CONSTANTS } from "../../shared/constants/middleware";

export async function authMiddleware(c: Context, next: Next) {
  // Allow root health check to bypass authentication
  if (c.req.path === AUTH_CONSTANTS.BYPASS_PATH) {
    return await next();
  }

  const tokenToUse = ENV.INTERNAL_AUTH_TOKEN;
  const authHeader = c.req.header(AUTH_CONSTANTS.HEADER_AUTHORIZATION);
  const xInternalHeader = c.req.header(AUTH_CONSTANTS.HEADER_INTERNAL_TOKEN);

  let receivedToken = "";
  if (authHeader && authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
    receivedToken = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX.length);
  } else if (xInternalHeader) {
    receivedToken = xInternalHeader;
  }

  if (!receivedToken || receivedToken !== tokenToUse) {
    logger.warn(`Unauthorized access attempt to Agent endpoint: ${c.req.path} from IP: ${c.req.header(AUTH_CONSTANTS.HEADER_FORWARDED_FOR) || AUTH_CONSTANTS.DEFAULT_IP}`);
    return c.json({
      status: "error",
      message: AUTH_CONSTANTS.FORBIDDEN_MESSAGE
    }, 403);
  }

  await next();
}
