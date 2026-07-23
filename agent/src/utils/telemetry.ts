import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { logger } from "../shared/utils/logger";
import { diag, DiagLogger, DiagLogLevel } from "@opentelemetry/api";
import { ENV } from "../config/env";

const publicKey = ENV.LANGFUSE_PUBLIC_KEY;
const secretKey = ENV.LANGFUSE_SECRET_KEY;
const baseUrl = ENV.LANGFUSE_BASE_URL;

const isDummyKey = !publicKey || publicKey.startsWith('pk-lf-dummy') || !secretKey || secretKey.startsWith('sk-lf-dummy');
const isExplicitlyDisabled = ENV.ENABLE_TELEMETRY === 'false';

if (isDummyKey || isExplicitlyDisabled) {
    logger.info(`⏭️ Skipping OpenTelemetry initialization (${isDummyKey ? 'dummy/missing Langfuse keys' : 'ENABLE_TELEMETRY=false'})`);
} else {
    const customLogger: DiagLogger = {
        verbose: (message, ...args) => logger.debug(`[OTEL] ${message}`, ...args),
        debug: (message, ...args) => logger.debug(`[OTEL] ${message}`, ...args),
        info: (message, ...args) => logger.info(`[OTEL] ${message}`, ...args),
        warn: (message, ...args) => logger.warn(`[OTEL] ${message}`, ...args),
        error: (message, ...args) => logger.error(`[OTEL] ${message}`, ...args),
    };

    diag.setLogger(customLogger, DiagLogLevel.DEBUG);

    logger.info("Initializing OpenTelemetry SDK with LangfuseSpanProcessor...");

    const langfuseSpanProcessor = new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl,
    });

    const sdk = new NodeSDK({
        spanProcessors: [langfuseSpanProcessor as any],
    });

    try {
        sdk.start();
        logger.info("✅ OpenTelemetry SDK initialized successfully");
    } catch (error) {
        logger.error("❌ Failed to initialize OpenTelemetry SDK:", error);
    }
}
