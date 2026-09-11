import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ObservationLevel } from "@langfuse/tracing";

const RESET = "\x1b[0m";

const BOLD = "\x1b[1m";

const DIM = "\x1b[2m";

const RED = "\x1b[31m";

const YELLOW = "\x1b[33m";

const MAGENTA = "\x1b[35m";

const CYAN = "\x1b[36m";

const GRAY = "\x1b[90m";

export type LogMetaPrimitive = string | number | boolean | null | undefined;

export type LogMetaValue = LogMetaPrimitive | Error | LogMeta | LogMetaValue[];

export type LogMeta = { [key: string]: LogMetaValue };

export type LogContext = LogMeta | Error | string | number | boolean;

function isLogRecord(value?: LogContext): value is LogMeta {
  return typeof value === "object" && value !== null && !(value instanceof Error) && !Array.isArray(value);
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");

  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`;
}

function serializeMeta(meta?: LogContext): LogMeta | undefined {
  if (!meta) return undefined;

  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message, stack: meta.stack };
  }

  if (isLogRecord(meta)) {
    const result: LogMeta = {};

    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        result[key] = { name: value.name, message: value.message, stack: value.stack };
      } else {
        // SAFETY: Object.entries values on LogMeta conform to LogMetaValue.
        result[key] = value as LogMetaValue;
      }
    }

    return result;
  }

  return { value: String(meta) };
}

function formatMeta(meta?: LogContext): string {
  const cleanMeta = serializeMeta(meta);

  if (!cleanMeta || !isLogRecord(cleanMeta)) return "";

  try {
    const keys = Object.keys(cleanMeta);

    if (keys.length === 0) return "";

    // Specially format HTTP request/response meta if it exists
    if (cleanMeta.method && (cleanMeta.url !== undefined || cleanMeta.path !== undefined)) {
      const parts: string[] = [];

      if (cleanMeta.traceparent && cleanMeta.traceparent !== "none") {
        parts.push(`traceparent: ${cleanMeta.traceparent}`);
      }

      if (cleanMeta.payload && isLogRecord(cleanMeta.payload) && Object.keys(cleanMeta.payload).length > 0) {
        parts.push(`payload: ${JSON.stringify(cleanMeta.payload)}`);
      }

      return parts.length > 0 ? ` ${DIM}(${parts.join(", ")})${RESET}` : "";
    }

    // Standard metadata formatting
    const entries = Object.entries(cleanMeta).map(([k, v]) => {
      const valStr = isLogRecord(v) || Array.isArray(v) ? JSON.stringify(v) : String(v);

      return `${k}=${valStr}`;
    });

    return ` ${GRAY}[${entries.join(" ")}]${RESET}`;
  } catch {
    // Formatting failures must not crash request logging; fall back to no meta
    return "";
  }
}

function writeToFile(level: string, msg: string, meta?: LogContext) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const logDir = join(process.cwd(), "logs");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `${dateStr}.log`);

    let metaStr = "";
    const cleanMeta = serializeMeta(meta);

    if (cleanMeta && isLogRecord(cleanMeta)) {
      metaStr = ` ${JSON.stringify(cleanMeta)}`;
    }

    const line = `[${level}] [${getTimestamp()}] ${msg}${metaStr}\n`;
    appendFileSync(logPath, line, "utf-8");
  } catch {
    // Fail silently to prevent crashing application
  }
}

const LEVEL_CONFIG = {
  INFO: { color: CYAN, consoleFn: "log" as const, fmt: (m: string) => m },
  WARN: { color: YELLOW, consoleFn: "warn" as const, fmt: (m: string) => `${YELLOW}${m}${RESET}` },
  ERROR: { color: RED, consoleFn: "error" as const, fmt: (m: string) => `${RED}${BOLD}${m}${RESET}` },
  DEBUG: { color: GRAY, consoleFn: "debug" as const, fmt: (m: string) => `${GRAY}${m}${RESET}` },
  TELEMETRY: { color: MAGENTA, consoleFn: "log" as const, fmt: (m: string) => `${MAGENTA}${m}${RESET}` },
  AGENT: { color: MAGENTA, consoleFn: "log" as const, fmt: (m: string) => `${MAGENTA}${m}${RESET}` },
} as const;

export type LogLevel = keyof typeof LEVEL_CONFIG;

const LANGFUSE_LEVEL_MAP = {
  INFO: "DEFAULT",
  WARN: "WARNING",
  ERROR: "ERROR",
  DEBUG: "DEBUG",
} as const satisfies Record<"INFO" | "WARN" | "ERROR" | "DEBUG", ObservationLevel>;

export class Logger {
  private log(level: LogLevel, msg: string, meta?: LogContext) {
    const config = LEVEL_CONFIG[level];

    if (config) {
      console[config.consoleFn](
        `${config.color}${BOLD}[${level}]${RESET}  ${DIM}[${getTimestamp()}]${RESET} ${config.fmt(msg)}${formatMeta(meta)}`,
      );
    }

    writeToFile(level, msg, meta);
  }

  info(msg: string, meta?: LogContext) {
    this.log("INFO", msg, meta);
  }

  warn(msg: string, meta?: LogContext) {
    this.log("WARN", msg, meta);
  }

  error(msg: string, meta?: LogContext) {
    this.log("ERROR", msg, meta);
  }

  debug(msg: string, meta?: LogContext) {
    this.log("DEBUG", msg, meta);
  }

  langfuse(level: "INFO" | "WARN" | "ERROR" | "DEBUG", msg: string, meta?: LogContext) {
    this.log(level, msg, meta);
    import("./langfuse")
      .then(({ langfuseStorage }) => {
        const store = langfuseStorage.getStore();
        const activeObservation = store?.span || store?.trace;

        if (activeObservation) {
          const cleanMeta = serializeMeta(meta);

          activeObservation.startObservation(
            msg,
            {
              input: msg,
              level: LANGFUSE_LEVEL_MAP[level],
              metadata: cleanMeta,
            },
            { asType: "event" },
          );
        }
      })
      .catch((err) => {
        this.debug(`Langfuse observation failed: ${err instanceof Error ? err.message : String(err)}`);
      });
  }

  telemetry(type: string, payload: LogMeta) {
    const spanId = String(payload.spanId ?? "unknown");
    const sessionId = String(payload.sessionId ?? "unknown");
    const inputObj = isLogRecord(payload.input) ? payload.input : undefined;
    const messages = Array.isArray(inputObj?.messages) ? inputObj.messages : [];
    const messagesCount = messages.length;
    const metaObj = isLogRecord(payload.metadata) ? payload.metadata : undefined;
    const cost = Number(metaObj?.monetary_cost_usd) || 0;

    this.log(
      "TELEMETRY",
      `${type.toUpperCase()} | Span: ${spanId} | Session: ${sessionId} | MsgCount: ${messagesCount} | Cost: $${cost.toFixed(5)}`,
      payload,
    );
  }

  agentActivity(missionId: string, event: string, msg: string, meta?: LogContext) {
    this.log("AGENT", `[${event}] [${missionId.slice(0, 8)}] ${msg}`, meta);
    writeToAgentActivityFile(missionId, event, msg, meta);
  }
}

function writeToAgentActivityFile(missionId: string, event: string, msg: string, meta?: LogContext) {
  try {
    const logDir = join(process.cwd(), "logs");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, "agent-activity.log");

    let metaStr = "";
    const cleanMeta = serializeMeta(meta);

    if (cleanMeta && isLogRecord(cleanMeta)) {
      metaStr = ` ${JSON.stringify(cleanMeta)}`;
    }

    const line = `[${getTimestamp()}] [Mission:${missionId.slice(0, 8)}] [${event}] ${msg}${metaStr}\n`;
    appendFileSync(logPath, line, "utf-8");
  } catch {
    // Fail silently
  }
}

export const logger = new Logger();
