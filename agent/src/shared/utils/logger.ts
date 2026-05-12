export class Logger {
    info(msg: string, meta?: any) {
        console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
    warn(msg: string, meta?: any) {
        console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
    error(msg: string, meta?: any) {
        console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
    debug(msg: string, meta?: any) {
        console.debug(`[DEBUG] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
}

export const logger = new Logger();
