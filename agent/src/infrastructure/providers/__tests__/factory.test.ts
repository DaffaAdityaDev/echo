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
    origRegistry = Reflect.get(ProviderFactory, "registry") as Map<string, unknown>;
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
    const p = ProviderFactory.fromConfig({
      type: "openai",
      base_url: "http://x.com",
      model: "gpt-4o",
      api_key: "sk-test",
    }) as unknown as { baseURL: string; modelName: string; apiKey?: string };
    expect(p.baseURL).toBe("http://x.com");
    expect(p.modelName).toBe("gpt-4o");
    expect(p.apiKey).toBe("sk-test");
  });

  it("throws a clear error for an unknown provider type", () => {
    expect(() =>
      ProviderFactory.fromConfig({
        type: "unknown",
        base_url: "http://d",
        model: "fallback",
      } as unknown as Parameters<typeof ProviderFactory.fromConfig>[0]),
    ).toThrow(/Unknown provider type/);
  });

  it("resolveType maps a provider instance back to its registry key", () => {
    const p = ProviderFactory.fromConfig({ type: "openai", base_url: "http://a", model: "gpt-4" });
    expect(ProviderFactory.resolveType(p as unknown as import("../../../shared/types").LLMProvider)).toBe("openai");
  });
});
