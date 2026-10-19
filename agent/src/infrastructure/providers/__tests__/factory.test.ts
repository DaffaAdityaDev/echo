class FakeOpenAI {
  baseURL: string;
  modelName: string;
  apiKey?: string;
  constructor(baseURL: string, modelName: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.modelName = modelName;
    this.apiKey = apiKey;
  }
}

class FakeAnthropic {
  baseURL: string;
  modelName: string;
  apiKey?: string;
  constructor(baseURL: string, modelName: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.modelName = modelName;
    this.apiKey = apiKey;
  }
}

class FakeLMStudio {
  baseURL: string;
  modelName: string;
  apiKey?: string;
  constructor(baseURL: string, modelName: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.modelName = modelName;
    this.apiKey = apiKey;
  }
}

class FakeOpenCodeGo {
  baseURL: string;
  modelName: string;
  apiKey?: string;
  constructor(baseURL: string, modelName: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.modelName = modelName;
    this.apiKey = apiKey;
  }
}

import { ProviderFactory } from "../factory";

describe("ProviderFactory", () => {
  let origRegistry: Map<string, unknown>;
  let origOpenAI: unknown;

  beforeAll(() => {
    // SAFETY: Access private provider factory registry for testing
    origRegistry = (ProviderFactory as typeof ProviderFactory & { registry: Map<string, unknown> }).registry;
    origOpenAI = origRegistry.get("openai");
    origRegistry.set("openai", FakeOpenAI);
    origRegistry.set("anthropic", FakeAnthropic);
    origRegistry.set("lm-studio", FakeLMStudio);
    origRegistry.set("opencode-go", FakeOpenCodeGo);
  });

  afterAll(() => {
    if (origOpenAI !== undefined) {
      origRegistry.set("openai", origOpenAI);
    }
  });

  it('type="openai" returns OpenAIProvider', () => {
    const p = ProviderFactory.fromConfig({ type: "openai", base_url: "http://a", model: "gpt-4" });
    expect(p.constructor.name).toBe("FakeOpenAI");
  });

  it('type="anthropic" returns AnthropicProvider', () => {
    const p = ProviderFactory.fromConfig({ type: "anthropic", base_url: "http://b", model: "claude-3" });
    expect(p.constructor.name).toBe("FakeAnthropic");
  });

  it('type="lm-studio" returns LMStudioProvider', () => {
    const p = ProviderFactory.fromConfig({ type: "lm-studio", base_url: "http://localhost:1234", model: "llama" });
    expect(p.constructor.name).toBe("FakeLMStudio");
  });

  it('type="opencode-go" returns OpenCodeGoProvider', () => {
    const p = ProviderFactory.fromConfig({ type: "opencode-go", base_url: "http://c", model: "opencode-go/model" });
    expect(p.constructor.name).toBe("FakeOpenCodeGo");
  });

  it("passes constructor arguments correctly", () => {
    // SAFETY: FakeOpenAI instance registered for openai provider type
    const p = ProviderFactory.fromConfig({
      type: "openai",
      base_url: "http://x.com",
      model: "gpt-4o",
      api_key: "sk-test",
    }) as FakeOpenAI;

    expect(p.baseURL).toBe("http://x.com");
    expect(p.modelName).toBe("gpt-4o");
    expect(p.apiKey).toBe("sk-test");
  });

  it("throws a clear error for an unknown provider type", () => {
    expect(() =>
      // SAFETY: Unknown provider type passed to verify validation error branch
      ProviderFactory.fromConfig({
        type: "unknown",
        base_url: "http://d",
        model: "fallback",
      } as never),
    ).toThrow(/Unknown provider type/);
  });

  it("resolveType maps a provider instance back to its registry key", () => {
    const p = ProviderFactory.fromConfig({ type: "openai", base_url: "http://a", model: "gpt-4" });
    // SAFETY: FakeOpenAI instance resolved through factory type mapping
    expect(ProviderFactory.resolveType(p as never)).toBe("openai");
  });
});
