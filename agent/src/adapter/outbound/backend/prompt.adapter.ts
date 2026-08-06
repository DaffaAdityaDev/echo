import type Redis from "ioredis";
import { ENV } from "../../../config/env";
import { getRedisClient } from "../../../infrastructure/cache/redis";
import { signServiceJwt } from "../../../shared/utils/jwt";
import { logger } from "../../../shared/utils/logger";

const PROMPT_ENDPOINT = "/api/v1/internal/prompts/active";
const CACHE_TTL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 5000;

export interface ActivePrompt {
  version: number;
  systemPrompt: string;
  boundTools: string[];
  variables: string[];
}

interface ActivePromptResponse {
  version?: unknown;
  system_prompt?: unknown;
  bound_tools?: unknown;
  variables?: unknown;
}

export interface PromptAdapterOptions {
  baseUrl?: string;
  redis?: Redis | null;
}

export class PromptAdapter {
  private baseUrl: string;
  private redis: Redis | null;

  constructor(options: PromptAdapterOptions = {}) {
    this.baseUrl = options.baseUrl || ENV.BACKEND_URL || "http://localhost:8080";
    this.redis = options.redis !== undefined ? options.redis : getRedisClient();
  }

  async getActivePrompt(templateName: string, tenantId: string): Promise<ActivePrompt | null> {
    const cached = await this.readCache(templateName, tenantId);
    if (cached) return cached;

    const prompt = await this.fetchActivePrompt(templateName, tenantId);
    if (prompt) {
      await this.writeCache(templateName, tenantId, prompt);
    }
    return prompt;
  }

  private cacheKey(templateName: string, tenantId: string): string {
    return `agent:prompts:${tenantId}:${templateName}`;
  }

  private async readCache(templateName: string, tenantId: string): Promise<ActivePrompt | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.cacheKey(templateName, tenantId));
      if (!raw) return null;
      return JSON.parse(raw) as ActivePrompt;
    } catch {
      return null;
    }
  }

  private async writeCache(templateName: string, tenantId: string, prompt: ActivePrompt): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(this.cacheKey(templateName, tenantId), JSON.stringify(prompt), "EX", CACHE_TTL_SECONDS);
    } catch {
      // Cache write failures must not fail the prompt resolution
    }
  }

  private async fetchActivePrompt(templateName: string, tenantId: string): Promise<ActivePrompt | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const token = signServiceJwt();
      const url = `${this.baseUrl}${PROMPT_ENDPOINT}?template=${encodeURIComponent(templateName)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-Tenant-ID": tenantId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn(`Prompt request failed: ${res.status} ${res.statusText}`, { templateName, tenantId });
        return null;
      }
      const data = (await res.json()) as ActivePromptResponse;
      if (typeof data.version !== "number" || typeof data.system_prompt !== "string") {
        logger.warn(`Prompt response is malformed`, { templateName, tenantId });
        return null;
      }
      return {
        version: data.version,
        systemPrompt: data.system_prompt,
        boundTools: Array.isArray(data.bound_tools) ? (data.bound_tools as string[]) : [],
        variables: Array.isArray(data.variables) ? (data.variables as string[]) : [],
      };
    } catch (err) {
      logger.warn(`Prompt request failed`, { templateName, tenantId, error: err });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
