const mockEnv = vi.hoisted(() => ({
  STATE_BACKEND: "memory",
  BACKEND_URL: "",
}));

vi.mock("../../../../config/env", () => ({
  ENV: mockEnv,
}));

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../../shared/utils/jwt", () => ({
  signServiceJwt: vi.fn(() => "test-token"),
}));

describe("stateStorage factory", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("creates an InMemoryStateProvider when STATE_BACKEND is memory", async () => {
    mockEnv.STATE_BACKEND = "memory";
    mockEnv.BACKEND_URL = "";

    const { stateStorage } = await import("../factory");
    const { InMemoryStateProvider } = await import("../memory");

    expect(stateStorage).toBeInstanceOf(InMemoryStateProvider);
  });

  test("creates a MemoryAdapter when STATE_BACKEND is backend", async () => {
    mockEnv.STATE_BACKEND = "backend";
    mockEnv.BACKEND_URL = "http://backend:8080";

    const { stateStorage } = await import("../factory");
    const { MemoryAdapter } = await import("../../../../adapter/outbound/backend/memory.adapter");

    expect(stateStorage).toBeInstanceOf(MemoryAdapter);
  });
});
