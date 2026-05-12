import { LMStudioProvider } from "./lm-studio";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { LLMProvider } from "../types";
import { LLM_API_VERSIONS } from "../../shared/constants";

export class ProviderFactory {
    static create(model: string, baseHost: string): LLMProvider {
        const type = this.detectProviderType(model, baseHost);
        
        // Clean the base host from any trailing slashes
        const host = baseHost.replace(/\/$/, '');

        switch (type) {
            case "lm-studio":
                // Application decides to use V1 for LM Studio
                return new LMStudioProvider(`${host}${LLM_API_VERSIONS.V1}`, model, process.env.LM_STUDIO_API_KEY);
            case "anthropic":
                return new AnthropicProvider("", model, process.env.ANTHROPIC_API_KEY);
            case "openai":
                // Application decides to use V1 for OpenAI-compatible
                return new OpenAIProvider(`${host}${LLM_API_VERSIONS.V1}`, model, process.env.OPENAI_API_KEY);
            default:
                return new OpenAIProvider(`${host}${LLM_API_VERSIONS.V1}`, model, process.env.OPENAI_API_KEY);
        }
    }

    private static detectProviderType(model: string, baseURL: string): string {
        const lowerModel = model.toLowerCase();
        if (baseURL.includes(":1234") || baseURL.includes("lm-studio") || lowerModel.includes("r1")) {
            return "lm-studio";
        }
        if (lowerModel.includes("claude") || lowerModel.includes("anthropic")) {
            return "anthropic";
        }
        return "openai";
    }
}
