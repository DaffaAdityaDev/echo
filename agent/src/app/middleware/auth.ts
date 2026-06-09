import { Context, Next } from "hono";
import { logger } from "../../shared/utils/logger";
import { ENV } from "../../config/env";

export async function authMiddleware(c: Context, next: Next) {
  // Allow root health check to bypass authentication
  if (c.req.path === "/") {
    return await next();
  }

  const tokenToUse = ENV.INTERNAL_AUTH_TOKEN;
  const authHeader = c.req.header("Authorization");
  const xInternalHeader = c.req.header("X-Internal-Token");

  let receivedToken = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    receivedToken = authHeader.substring(7);
  } else if (xInternalHeader) {
    receivedToken = xInternalHeader;
  }

  if (!receivedToken || receivedToken !== tokenToUse) {
    logger.warn(`Unauthorized access attempt to Agent endpoint: ${c.req.path} from IP: ${c.req.header("x-forwarded-for") || "unknown"}`);
    return c.json({
      status: "error",
      message: "Forbidden: Invalid or missing internal token authentication credentials."
    }, 403);
  }

  await next();
}
