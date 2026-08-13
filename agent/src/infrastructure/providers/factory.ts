import type { LLMProvider } from "../../shared/types";
import { AnthropicProvider } from "./anthropic";
import { LMStudioProvider } from "./lm-studio";
import { OpenAIProvider } from "./openai";
import { OpenCodeGoProvider } from "./opencode-go";

export interface ProviderConnectionConfig {
  type: "openai" | "anthropic" | "lm-studio" | "opencode-go";
  base_url: string;
  api_key?: string;
  model: string;
}

export function isProviderConnectionConfig(value: unknown): value is ProviderConnectionConfig {
  if (typeof value !== "object" || value === null) return false;
  const cfg = value as Record<string, unknown>;
  if (cfg.type !== "openai" && cfg.type !== "anthropic" && cfg.type !== "lm-studio" && cfg.type !== "opencode-go") {
    return false;
  }
  if (typeof cfg.base_url !== "string" || typeof cfg.model !== "string") return false;
  if (cfg.api_key !== undefined && cfg.api_key !== null && typeof cfg.api_key !== "string") return false;
  return true;
}

type ProviderCtor = new (baseUrl: string, modelName: string, apiKey?: string) => LLMProvider;

export const ProviderFactory = {
  registry: new Map<string, ProviderCtor>([
    ["opencode-go", OpenCodeGoProvider],
    ["lm-studio", LMStudioProvider],
    ["anthropic", AnthropicProvider],
    ["openai", OpenAIProvider],
  ]),

  fromConfig(config: ProviderConnectionConfig): LLMProvider {
    const Provider = ProviderFactory.registry.get(config.type);
    if (!Provider) {
      throw new Error(
        `Unknown provider type: "${config.type}". Supported types: ${[...ProviderFactory.registry.keys()].join(", ")}`,
      );
    }
    return new Provider(config.base_url, config.model, config.api_key);
  },

  resolveType(provider: LLMProvider): string | undefined {
    for (const [type, Ctor] of ProviderFactory.registry) {
      if (provider instanceof Ctor) return type;
    }
    return undefined;
  },
};
