import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LogFileSink } from "../log-file-sink";

describe("LogFileSink", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "log-sink-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  test("creates the directory lazily and appends lines in order", async () => {
    const sink = new LogFileSink(join(root, "nested", "logs"));

    sink.write("app.log", "one\n");
    sink.write("app.log", "two\n");
    await sink.close("app.log");

    expect(readFileSync(join(root, "nested", "logs", "app.log"), "utf-8")).toBe("one\ntwo\n");
  });

  test("appends to an existing file instead of truncating it", async () => {
    writeFileSync(join(root, "app.log"), "existing\n");
    const sink = new LogFileSink(root);

    sink.write("app.log", "new\n");
    await sink.close("app.log");

    expect(readFileSync(join(root, "app.log"), "utf-8")).toBe("existing\nnew\n");
  });

  test("reports an unusable directory once and stops writing", () => {
    const blocker = join(root, "not-a-dir");
    writeFileSync(blocker, "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = new LogFileSink(join(blocker, "logs"));

    sink.write("app.log", "a\n");
    sink.write("app.log", "b\n");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("File logging disabled");
  });
});
