import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./shared/utils/logger";
import { logger as honoLogger } from "hono/logger";
import missionRoutes from "./modules/mission/mission.routes";
import modelRoutes from "./modules/model/model.routes";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("*", honoLogger());

// Routes
app.route("/api", missionRoutes);
app.route("/api", modelRoutes);

import { AppError } from "./shared/utils/errors";

// Error Handling
app.onError((err, c) => {
    if (err instanceof AppError) {
        return c.json({ 
            status: "error", 
            message: err.message,
            ...(err.errors && { details: err.errors })
        }, err.statusCode as any);
    }

    logger.error("Unhandled system error", err);
    return c.json({ 
        status: "error", 
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    }, 500);
});

const PORT = 3001;

logger.info(`Agent Platform booting...`);
logger.info(`Backend Service: Standard Modular Pattern`);
logger.info(`Harness Service: Isolated Core Engine`);

export default {
    port: PORT,
    fetch: app.fetch,
};
