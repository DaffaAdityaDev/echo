const mockEnv = vi.hoisted(() => ({
  ENV: {
    LANGFUSE_PUBLIC_KEY: "pk-lf-dummy",
    LANGFUSE_SECRET_KEY: "sk-lf-dummy",
    LANGFUSE_BASE_URL: "http://langfuse.test",
    ENABLE_TELEMETRY: "false",
  },
}));

const mockLogger = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockOtelApi = vi.hoisted(() => ({
  diag: { setLogger: vi.fn() },
  DiagLogLevel: { DEBUG: 1 },
}));

const mockSdk = vi.hoisted(() => {
  function makeNodeSDK() {
    return { start: vi.fn() };
  }
  return {
    LangfuseSpanProcessor: vi.fn(),
    NodeSDK: vi.fn(makeNodeSDK),
  };
});

vi.mock("../../../config/env", () => ({ ENV: mockEnv.ENV }));

vi.mock("../logger", () => mockLogger);

vi.mock("@langfuse/otel", () => ({ LangfuseSpanProcessor: mockSdk.LangfuseSpanProcessor }));

vi.mock("@opentelemetry/api", () => mockOtelApi);

vi.mock("@opentelemetry/sdk-node", () => ({ NodeSDK: mockSdk.NodeSDK }));

const DEFAULT_ENV = {
  LANGFUSE_PUBLIC_KEY: "pk-lf-dummy",
  LANGFUSE_SECRET_KEY: "sk-lf-dummy",
  LANGFUSE_BASE_URL: "http://langfuse.test",
  ENABLE_TELEMETRY: "false",
};

describe("telemetry module", () => {
  beforeEach(() => {
    mockEnv.ENV.LANGFUSE_PUBLIC_KEY = DEFAULT_ENV.LANGFUSE_PUBLIC_KEY;
    mockEnv.ENV.LANGFUSE_SECRET_KEY = DEFAULT_ENV.LANGFUSE_SECRET_KEY;
    mockEnv.ENV.LANGFUSE_BASE_URL = DEFAULT_ENV.LANGFUSE_BASE_URL;
    mockEnv.ENV.ENABLE_TELEMETRY = DEFAULT_ENV.ENABLE_TELEMETRY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("skips OpenTelemetry initialization with dummy keys", async () => {
    mockEnv.ENV.ENABLE_TELEMETRY = "true";
    await import("../telemetry");
    expect(mockLogger.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping OpenTelemetry initialization"),
    );
    expect(mockSdk.NodeSDK).not.toHaveBeenCalled();
  });

  test("skips OpenTelemetry initialization with missing keys", async () => {
    mockEnv.ENV.LANGFUSE_PUBLIC_KEY = "";
    mockEnv.ENV.LANGFUSE_SECRET_KEY = "";
    mockEnv.ENV.ENABLE_TELEMETRY = "true";
    await import("../telemetry");
    expect(mockLogger.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping OpenTelemetry initialization"),
    );
    expect(mockSdk.NodeSDK).not.toHaveBeenCalled();
  });

  test("skips OpenTelemetry initialization when telemetry is disabled", async () => {
    mockEnv.ENV.LANGFUSE_PUBLIC_KEY = "pk-lf-real";
    mockEnv.ENV.LANGFUSE_SECRET_KEY = "sk-lf-real";
    await import("../telemetry");
    expect(mockLogger.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping OpenTelemetry initialization"),
    );
    expect(mockSdk.NodeSDK).not.toHaveBeenCalled();
  });

  test("initializes the OpenTelemetry SDK with real keys", async () => {
    mockEnv.ENV.LANGFUSE_PUBLIC_KEY = "pk-lf-real";
    mockEnv.ENV.LANGFUSE_SECRET_KEY = "sk-lf-real";
    mockEnv.ENV.ENABLE_TELEMETRY = "true";
    await import("../telemetry");
    expect(mockSdk.LangfuseSpanProcessor).toHaveBeenCalledWith({
      publicKey: "pk-lf-real",
      secretKey: "sk-lf-real",
      baseUrl: "http://langfuse.test",
    });
    expect(mockSdk.NodeSDK).toHaveBeenCalled();
    expect(mockOtelApi.diag.setLogger).toHaveBeenCalled();
    expect(mockLogger.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("OpenTelemetry SDK initialized successfully"),
    );
  });
});
