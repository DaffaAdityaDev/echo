import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join } from "node:path";

/**
 * Non-blocking append-only sink for log files in a single directory.
 * The directory is created once and each file keeps one open append stream, so
 * writing a log line never performs synchronous filesystem calls on the event loop.
 */
export class LogFileSink {
  private readonly streams = new Map<string, WriteStream>();
  private directoryReady = false;
  private disabled = false;

  constructor(private readonly directory: string) {}

  write(fileName: string, line: string): void {
    if (this.disabled) return;

    const stream = this.streamFor(fileName);

    if (stream) stream.write(line);
  }

  close(fileName: string): Promise<void> {
    const stream = this.streams.get(fileName);
    this.streams.delete(fileName);

    if (!stream) return Promise.resolve();

    return new Promise((resolve) => stream.end(resolve));
  }

  private streamFor(fileName: string): WriteStream | undefined {
    const existing = this.streams.get(fileName);

    if (existing) return existing;

    if (!this.ensureDirectory()) return undefined;

    const stream = createWriteStream(join(this.directory, fileName), { flags: "a", encoding: "utf-8" });
    stream.on("error", (err) => this.disable(`stream ${fileName}`, err));
    this.streams.set(fileName, stream);

    return stream;
  }

  private ensureDirectory(): boolean {
    if (this.directoryReady) return true;

    try {
      mkdirSync(this.directory, { recursive: true });
      this.directoryReady = true;
    } catch (err) {
      this.disable(`directory ${this.directory}`, err);
    }

    return this.directoryReady;
  }

  // File logging is best-effort: report the failure once on stderr and keep console logging alive.
  private disable(target: string, err: unknown): void {
    if (this.disabled) return;

    this.disabled = true;
    console.error(`[LOGGER] File logging disabled (${target}): ${err instanceof Error ? err.message : String(err)}`);

    for (const stream of this.streams.values()) stream.destroy();
    this.streams.clear();
  }
}
