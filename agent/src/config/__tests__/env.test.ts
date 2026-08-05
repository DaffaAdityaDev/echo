import { ENV_DEFAULTS } from "../env.constants";
import { envSchema } from "../env.schema";

const validInput = {
  PORT: "3001",
  GRPC_PORT: "50051",
  CHROMA_URL: "http://localhost:8000",
  LLM_MODEL_API_URL: "http://127.0.0.1:1234",
  STATE_BACKEND: "memory",
  NODE_ENV: "development",
  DEBUG_PROMPT: false,
  INTERNAL_AUTH_TOKEN: "test-token",
  LANGFUSE_PUBLIC_KEY: "pk-lf-test",
  LANGFUSE_SECRET_KEY: "sk-lf-test",
  LANGFUSE_BASE_URL: "http://localhost:3000",
  AGENT_RUNTIME_MODE: "local",
  SERVICE_JWT_SECRET: "x".repeat(32),
  BACKEND_URL: "http://localhost:8080",
  MCP_SERVER_URL: "http://localhost:8081",
  ENABLE_MCP: false,
  ENABLE_REST_TOOLS: false,
  ENABLE_TELEMETRY: "true",
};

describe("envSchema", () => {
  test("a complete valid input passes", () => {
    const result = envSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("omitting a required field fails", () => {
    const { INTERNAL_AUTH_TOKEN: _omitted, ...rest } = validInput;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("invalid enum value fails", () => {
    const result = envSchema.safeParse({ ...validInput, STATE_BACKEND: "file" });
    expect(result.success).toBe(false);
  });

  test("invalid type fails", () => {
    const portResult = envSchema.safeParse({ ...validInput, PORT: 3001 });
    expect(portResult.success).toBe(false);

    const grpcResult = envSchema.safeParse({ ...validInput, GRPC_PORT: 50051 });
    expect(grpcResult.success).toBe(false);
  });

  test("invalid url fails", () => {
    const result = envSchema.safeParse({ ...validInput, BACKEND_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test("defaults are applied when fields are omitted", () => {
    const result = envSchema.safeParse({ INTERNAL_AUTH_TOKEN: "test-token" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.PORT).toBe(ENV_DEFAULTS.PORT);
    expect(result.data.GRPC_PORT).toBe(ENV_DEFAULTS.GRPC_PORT);
    expect(result.data.CHROMA_URL).toBe(ENV_DEFAULTS.CHROMA_URL);
    expect(result.data.LLM_MODEL_API_URL).toBe(ENV_DEFAULTS.LLM_MODEL_API_URL);
    expect(result.data.LANGFUSE_BASE_URL).toBe(ENV_DEFAULTS.LANGFUSE_BASE_URL);
    expect(result.data.BACKEND_URL).toBe(ENV_DEFAULTS.BACKEND_URL);
    expect(result.data.STATE_BACKEND).toBe("memory");
    expect(result.data.NODE_ENV).toBe("development");
    expect(result.data.DEBUG_PROMPT).toBe(false);
    expect(result.data.AGENT_RUNTIME_MODE).toBe("local");
    expect(result.data.ENABLE_MCP).toBe(false);
    expect(result.data.ENABLE_REST_TOOLS).toBe(false);
    expect(result.data.ENABLE_TELEMETRY).toBe("true");
  });
});
