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
  let origRegistry: Map<string, new (...args: any[]) => any>;

  beforeAll(() => {
    origRegistry = Reflect.get(ProviderFactory, "registry") as Map<string, new (...args: any[]) => any>;
    origRegistry.set("openai", FakeOpenAI as any);
    origRegistry.set("anthropic", FakeAnthropic as any);
    origRegistry.set("lm-studio", FakeLMStudio as any);
    origRegistry.set("opencode-go", FakeOpenCodeGo as any);
  });

  afterAll(() => {
    origRegistry.set("openai", origRegistry.get("openai")!);
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
    }) as any;
    expect(p.baseURL).toBe("http://x.com");
    expect(p.modelName).toBe("gpt-4o");
    expect(p.apiKey).toBe("sk-test");
  });

  it("unknown type falls back to OpenAIProvider (module-level fallback)", () => {
    const p = ProviderFactory.fromConfig({ type: "unknown" as any, base_url: "http://d", model: "fallback" });
    expect(p).toBeDefined();
  });
});
