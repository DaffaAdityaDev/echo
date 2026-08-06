import "./config/env";
import "./shared/utils/telemetry";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import routes from "./adapter/inbound/api/routes";
import { authMiddleware } from "./adapter/inbound/middleware/auth";
import { errorHandler } from "./adapter/inbound/middleware/error";
import { monitorMiddleware } from "./adapter/inbound/middleware/monitor";
import { MemoryAdapter } from "./adapter/outbound/backend/memory.adapter";
import { ENV } from "./config/env";
import { CredentialManager } from "./core/agent/credentials";
import { toolRegistry } from "./core/agent/tools";
import { initRedis } from "./infrastructure/cache/redis";
import { logger } from "./shared/utils/logger";

// Autoload Agent Tools
await toolRegistry.autoload();

// Initialize Redis (mission event store)
initRedis(ENV.REDIS_URL);

// Cleanup leftover files from previous sessions at startup only
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
rmSync(join(root, "debug"), { recursive: true, force: true });
rmSync(join(root, "logs"), { recursive: true, force: true });
logger.info("Startup cleanup complete (debug/, logs/)");

// Initialize Memory Client
const memoryProvider = new MemoryAdapter(ENV.BACKEND_URL);
logger.info("Memory client initialized (backend)");

// Initialize Credential Manager
const credentialManager = new CredentialManager();
toolRegistry.setCredentialManager(credentialManager);
logger.info("Credential manager initialized");

// Initialize MCP clients if configured
if (ENV.ENABLE_MCP && ENV.MCP_SERVER_URL) {
  logger.info(`MCP server configured at ${ENV.MCP_SERVER_URL}`);
  try {
    await toolRegistry.connectMCPServer({
      name: "default-mcp",
      url: ENV.MCP_SERVER_URL,
      transport: "sse",
    });
  } catch (mcpErr: unknown) {
    logger.warn(
      `Failed to connect MCP server at ${ENV.MCP_SERVER_URL}: ${mcpErr instanceof Error ? mcpErr.message : String(mcpErr)}`,
    );
  }
}

import docsRouter from "./adapter/inbound/api/docs/docs";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("*", monitorMiddleware);
app.use("/api/*", authMiddleware);

// Routes
app.get("/", (c) => c.json({ status: "ok", service: "agent-platform" }));
app.route("/api", routes);
app.route("/docs", docsRouter);

// Error Handling
app.onError(errorHandler);

const PORT = parseInt(ENV.PORT, 10);

logger.info(`Agent Platform booting...`);
logger.info(`Backend Service: Standard Modular Pattern`);
logger.info(`Harness Service: Isolated Core Engine`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 255,
};

export { credentialManager, memoryProvider };
