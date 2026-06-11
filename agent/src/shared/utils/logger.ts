import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";

function getTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`;
}

function serializeMeta(meta: any): any {
    if (!meta) return undefined;
    if (meta instanceof Error) {
        return { name: meta.name, message: meta.message, stack: meta.stack };
    }
    if (typeof meta === 'object') {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(meta)) {
            if (value instanceof Error) {
                result[key] = { name: value.name, message: value.message, stack: value.stack };
            } else {
                result[key] = value;
            }
        }
        return result;
    }
    return meta;
}

function formatMeta(meta?: any): string {
    const cleanMeta = serializeMeta(meta);
    if (!cleanMeta || typeof cleanMeta !== 'object') return '';
    try {
        const keys = Object.keys(cleanMeta);
        if (keys.length === 0) return '';
        
        // Specially format HTTP request/response meta if it exists
        if (cleanMeta.method && (cleanMeta.url !== undefined || cleanMeta.path !== undefined)) {
            const parts: string[] = [];
            if (cleanMeta.traceparent && cleanMeta.traceparent !== 'none') {
                parts.push(`traceparent: ${cleanMeta.traceparent}`);
            }
            if (cleanMeta.payload && Object.keys(cleanMeta.payload).length > 0) {
                parts.push(`payload: ${JSON.stringify(cleanMeta.payload)}`);
            }
            return parts.length > 0 ? ` ${DIM}(${parts.join(', ')})${RESET}` : '';
        }

        // Standard metadata formatting
        const entries = Object.entries(cleanMeta).map(([k, v]) => {
            const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `${k}=${valStr}`;
        });
        return ` ${GRAY}[${entries.join(' ')}]${RESET}`;
    } catch {
        return '';
    }
}

function writeToFile(level: string, msg: string, meta?: any) {
    try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const logDir = join(process.cwd(), 'logs');
        mkdirSync(logDir, { recursive: true });
        const logPath = join(logDir, `${dateStr}.log`);

        let metaStr = '';
        const cleanMeta = serializeMeta(meta);
        if (cleanMeta && typeof cleanMeta === 'object') {
            metaStr = ' ' + JSON.stringify(cleanMeta);
        }
        const line = `[${level}] [${getTimestamp()}] ${msg}${metaStr}\n`;
        appendFileSync(logPath, line, 'utf-8');
    } catch {
        // Fail silently to prevent crashing application
    }
}

export class Logger {
    langfuse(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', msg: string, meta?: any) {
        // Log locally first
        if (level === 'INFO') {
            console.log(`${CYAN}${BOLD}[INFO]${RESET}  ${DIM}[${getTimestamp()}]${RESET} ${msg}${formatMeta(meta)}`);
            writeToFile('INFO', msg, meta);
        } else if (level === 'WARN') {
            console.warn(`${YELLOW}${BOLD}[WARN]${RESET}  ${DIM}[${getTimestamp()}]${RESET} ${YELLOW}${msg}${RESET}${formatMeta(meta)}`);
            writeToFile('WARN', msg, meta);
        } else if (level === 'ERROR') {
            console.error(`${RED}${BOLD}[ERROR]${RESET} ${DIM}[${getTimestamp()}]${RESET} ${RED}${BOLD}${msg}${RESET}${formatMeta(meta)}`);
            writeToFile('ERROR', msg, meta);
        } else if (level === 'DEBUG') {
            console.debug(`${GRAY}${BOLD}[DEBUG]${RESET} ${DIM}[${getTimestamp()}]${RESET} ${GRAY}${msg}${RESET}${formatMeta(meta)}`);
            writeToFile('DEBUG', msg, meta);
        }

        try {
            // Dynamic import to avoid circular dependency
            import('../../utils/langfuse').then(({ langfuseStorage }) => {
                const store = langfuseStorage.getStore();
                const activeObservation = store?.span || store?.trace;
                if (activeObservation) {
                    const levelMap: Record<string, string> = {
                        INFO: 'DEFAULT',
                        WARN: 'WARNING',
                        ERROR: 'ERROR',
                        DEBUG: 'DEBUG'
                    };
                    activeObservation.startObservation(msg, {
                        input: msg,
                        level: levelMap[level] || 'DEFAULT',
                        metadata: meta
                    }, { asType: "event" });
                }
            }).catch(() => {});
        } catch {
            // Fail silently to prevent logger crashing
        }
    }

    info(msg: string, meta?: any) {
        console.log(`${CYAN}${BOLD}[INFO]${RESET}  ${DIM}[${getTimestamp()}]${RESET} ${msg}${formatMeta(meta)}`);
        writeToFile('INFO', msg, meta);
    }
    warn(msg: string, meta?: any) {
        console.warn(`${YELLOW}${BOLD}[WARN]${RESET}  ${DIM}[${getTimestamp()}]${RESET} ${YELLOW}${msg}${RESET}${formatMeta(meta)}`);
        writeToFile('WARN', msg, meta);
    }
    error(msg: string, meta?: any) {
        console.error(`${RED}${BOLD}[ERROR]${RESET} ${DIM}[${getTimestamp()}]${RESET} ${RED}${BOLD}${msg}${RESET}${formatMeta(meta)}`);
        writeToFile('ERROR', msg, meta);
    }
    debug(msg: string, meta?: any) {
        console.debug(`${GRAY}${BOLD}[DEBUG]${RESET} ${DIM}[${getTimestamp()}]${RESET} ${GRAY}${msg}${RESET}${formatMeta(meta)}`);
        writeToFile('DEBUG', msg, meta);
    }
    telemetry(type: string, payload: Record<string, any>) {
        const spanId = payload.spanId || "unknown";
        const sessionId = payload.sessionId || "unknown";
        const messagesCount = payload.input?.messages?.length || 0;
        const cost = payload.metadata?.monetary_cost_usd || 0;
        console.log(
            `${MAGENTA}${BOLD}[TELEMETRY]${RESET} ${DIM}[${getTimestamp()}]${RESET} ${MAGENTA}${type.toUpperCase()}${RESET} | Span: ${CYAN}${spanId}${RESET} | Session: ${CYAN}${sessionId}${RESET} | MsgCount: ${YELLOW}${messagesCount}${RESET} | Cost: ${GREEN}$${cost.toFixed(5)}${RESET}`
        );
        writeToFile('TELEMETRY', `${type.toUpperCase()} | Span: ${spanId} | Session: ${sessionId} | MsgCount: ${messagesCount} | Cost: $${cost.toFixed(5)}`, payload);
    }
    agentActivity(missionId: string, event: string, msg: string, meta?: any) {
        const timestamp = getTimestamp();
        console.log(`${MAGENTA}${BOLD}[AGENT:${event}]${RESET} ${DIM}[${timestamp}]${RESET} [${missionId.slice(0, 8)}] ${msg}${formatMeta(meta)}`);
        writeToFile('AGENT_' + event, `[${missionId}] ${msg}`, meta);
        writeToAgentActivityFile(missionId, event, msg, meta);
    }
}

function writeToAgentActivityFile(missionId: string, event: string, msg: string, meta?: any) {
    try {
        const logDir = join(process.cwd(), 'logs');
        mkdirSync(logDir, { recursive: true });
        const logPath = join(logDir, 'agent-activity.log');

        let metaStr = '';
        const cleanMeta = serializeMeta(meta);
        if (cleanMeta && typeof cleanMeta === 'object') {
            metaStr = ' ' + JSON.stringify(cleanMeta);
        }
        const line = `[${getTimestamp()}] [Mission:${missionId.slice(0, 8)}] [${event}] ${msg}${metaStr}\n`;
        appendFileSync(logPath, line, 'utf-8');
    } catch {
        // Fail silently
    }
}

export const logger = new Logger();


