import { LMStudioProvider } from "./lm-studio";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { LLMProvider } from "../../shared/types";
import { LLM_API_VERSIONS } from "../../shared/constants";

export class ProviderFactory {
    static create(model: string, baseHost: string): LLMProvider {
        const type = this.detectProviderType(model, baseHost);
        
        // Clean the base host from any trailing slashes
        const host = baseHost.replace(/\/$/, '');

        switch (type) {
            case "lm-studio":
                return new LMStudioProvider(`${host}${LLM_API_VERSIONS.LM_STUDIO_NATIVE}`, model, process.env.LM_STUDIO_API_KEY);
            case "anthropic":
                return new AnthropicProvider("", model, process.env.ANTHROPIC_API_KEY);
            case "openai":
            default:
                return new OpenAIProvider(`${host}${LLM_API_VERSIONS.V1}`, model, process.env.OPENAI_API_KEY);
        }
    }

    static get(provider: string): LLMProvider {
        const model = process.env.LLM_MODEL || "deepseek-r1-distill-llama-8b";
        const baseHost = process.env.LLM_MODEL_API_URL || "http://localhost:1234/v1";

        switch (provider.toLowerCase()) {
            case "anthropic":
                return new AnthropicProvider("", "claude-3-5-sonnet-latest", process.env.ANTHROPIC_API_KEY);
            case "openai":
                return new OpenAIProvider(baseHost, "gpt-4o", process.env.OPENAI_API_KEY);
            case "gemini-local":
            default:
                // Map to LM Studio/OpenAI local endpoint if using gemini-local/default
                return new OpenAIProvider(baseHost.replace(/\/$/, '') + LLM_API_VERSIONS.V1, model, process.env.OPENAI_API_KEY);
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
