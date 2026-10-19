import { LangfuseSpanProcessor } from "@langfuse/otel";
import { type DiagLogFunction, type DiagLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ENV } from "../../config/env";
import { toLogCause } from "../../shared/utils/errors";
import { type LogContext, logger } from "../../shared/utils/logger";

const publicKey = ENV.LANGFUSE_PUBLIC_KEY;

const secretKey = ENV.LANGFUSE_SECRET_KEY;

const baseUrl = ENV.LANGFUSE_BASE_URL;

const isDummyKey =
  !publicKey || publicKey.startsWith("pk-lf-dummy") || !secretKey || secretKey.startsWith("sk-lf-dummy");

const isExplicitlyDisabled = ENV.ENABLE_TELEMETRY === "false";

function logOtel(level: "debug" | "info" | "warn" | "error", ...[message, ...args]: Parameters<DiagLogFunction>): void {
  const context: LogContext | undefined = args.length > 0 ? { args: args.map(toLogCause) } : undefined;
  logger[level](`[OTEL] ${message}`, context);
}

if (isDummyKey || isExplicitlyDisabled) {
  logger.info(
    `⏭️ Skipping OpenTelemetry initialization (${isDummyKey ? "dummy/missing Langfuse keys" : "ENABLE_TELEMETRY=false"})`,
  );
} else {
  const customLogger: DiagLogger = {
    verbose: (...params) => logOtel("debug", ...params),
    debug: (...params) => logOtel("debug", ...params),
    info: (...params) => logOtel("info", ...params),
    warn: (...params) => logOtel("warn", ...params),
    error: (...params) => {
      const [message] = params;

      if (message.includes("OTLPExporterError") || message.includes("Export failed")) {
        logger.debug(`[OTEL] Export warning (Langfuse server offline/404 at ${baseUrl}): ${message}`);
      } else {
        logOtel("error", ...params);
      }
    },
  };

  diag.setLogger(customLogger, DiagLogLevel.DEBUG);

  logger.info("Initializing OpenTelemetry SDK with LangfuseSpanProcessor...");

  const langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl,
  });

  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });

  try {
    sdk.start();
    logger.info("✅ OpenTelemetry SDK initialized successfully");
  } catch (error) {
    logger.error("❌ Failed to initialize OpenTelemetry SDK:", toLogCause(error));
  }
}
