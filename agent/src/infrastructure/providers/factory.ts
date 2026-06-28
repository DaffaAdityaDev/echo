import { LMStudioProvider } from "./lm-studio";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { OpenCodeGoProvider } from "./opencode-go";
import { LLMProvider } from "../../shared/types";

export interface ProviderConnectionConfig {
    type: 'openai' | 'anthropic' | 'lm-studio' | 'opencode-go';
    base_url: string;
    api_key?: string;
    model: string;
}

export class ProviderFactory {
    static fromConfig(config: ProviderConnectionConfig): LLMProvider {
        switch (config.type) {
            case "opencode-go":
                return new OpenCodeGoProvider(config.base_url, config.model, config.api_key);
            case "lm-studio":
                return new LMStudioProvider(config.base_url, config.model, config.api_key);
            case "anthropic":
                return new AnthropicProvider(config.base_url, config.model, config.api_key);
            case "openai":
            default:
                return new OpenAIProvider(config.base_url, config.model, config.api_key);
        }
    }
}

