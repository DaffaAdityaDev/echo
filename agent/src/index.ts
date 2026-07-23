import "./config/env";
import "./utils/telemetry";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { ENV } from "./config/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./shared/utils/logger";
import routes from "./app/api/routes";
import { monitorMiddleware } from "./app/middleware/monitor";
import { authMiddleware } from "./app/middleware/auth";
import { errorHandler } from "./app/middleware/error";
import { toolRegistry } from "./core/agent/tools/registry";
import { MemoryAdapter } from "./adapter/backend/memory.adapter";
import { CredentialManager } from "./core/agent/credentials/manager";

import { fileURLToPath } from "node:url";

// Autoload Agent Tools
await toolRegistry.autoload();

// Cleanup leftover files from previous sessions at startup only
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
rmSync(join(root, "debug"), { recursive: true, force: true });
rmSync(join(root, "logs"), { recursive: true, force: true });
logger.info("Startup cleanup complete (debug/, logs/)");

// Initialize Memory Client
const memoryProvider = new MemoryAdapter(ENV.BACKEND_INTERNAL_URL);
logger.info("Memory client initialized (backend)");

// Initialize Credential Manager
const credentialManager = new CredentialManager();
toolRegistry.setCredentialManager(credentialManager);
logger.info("Credential manager initialized");

// Initialize MCP clients if configured
if (ENV.ENABLE_MCP && ENV.MCP_SERVER_URL) {
  logger.info(`MCP server configured at ${ENV.MCP_SERVER_URL}`);
}

import docsRouter from "./app/api/docs/docs";

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

export { memoryProvider, credentialManager };
