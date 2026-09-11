import { ENV } from "../../../config/env";
import { deserializeAgentState, serializeAgentState } from "../../../core/agent/storage";
import type { AgentState, JsonValue } from "../../../shared/types";
import { signServiceJwt } from "../../../shared/utils/jwt";
import { logger } from "../../../shared/utils/logger";

const ENDPOINTS = {
  store: "/api/v1/internal/memory/episodic/store",
  recall: "/api/v1/internal/memory/episodic/recall",
};

interface MemoryRecallResponse {
  session_id?: string;
  entries?: Array<{ content?: JsonValue } | string>;
  content?: JsonValue;
}

function isString<T>(val: T): val is T & string {
  return typeof val === "string";
}

function parseRecallContent(content: string): JsonValue | null {
  try {
    // SAFETY: JSON parse output is a valid JSON value structure
    return JSON.parse(content) as JsonValue;
  } catch {
    logger.debug(`Memory recall content is not a single JSON document, falling back to fragment parsing`);
    let last: JsonValue | null = null;

    for (const fragment of content.split("\n")) {
      if (fragment === "") continue;

      try {
        // SAFETY: JSON fragment parse output is a valid JSON value structure
        last = JSON.parse(fragment) as JsonValue;
      } catch {
        // Skip fragments that are not standalone JSON documents
      }
    }

    return last;
  }
}

export class MemoryAdapter {
  readonly type = "memory";
  private baseUrl: string;
  private connected = false;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ENV.BACKEND_URL;
  }

  async connect() {
    try {
      await this.request("GET", "/health");
      this.connected = true;
    } catch {
      throw new Error(`Cannot connect to backend at ${this.baseUrl}`);
    }
  }

  async disconnect() {
    this.connected = false;
  }

  async health() {
    const start = Date.now();

    try {
      await this.request("GET", "/health");

      return { ok: true, latency: Date.now() - start };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }

  isConnected() {
    return this.connected;
  }

  getClient() {
    return this.baseUrl;
  }

  private async request(method: string, path: string, body?: JsonValue): Promise<JsonValue> {
    const token = signServiceJwt();

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Memory request failed: ${res.status} ${text}`);
    }

    // SAFETY: fetch response JSON adheres to valid JsonValue representation
    return (await res.json()) as JsonValue;
  }

  async get(missionId: string): Promise<AgentState | null> {
    try {
      // SAFETY: Backend recall response body adheres to MemoryRecallResponse structure
      const data = (await this.request("POST", ENDPOINTS.recall, {
        session_id: missionId,
      })) as MemoryRecallResponse | null;

      if (!data) return null;

      let content = "";

      if (Array.isArray(data.entries) && data.entries.length > 0) {
        content = data.entries
          .map((entry) => {
            if (isString(entry)) return entry;
            const entryContent = entry?.content;

            if (isString(entryContent)) return entryContent;

            if (entryContent == null) return "";

            return JSON.stringify(entryContent);
          })
          .filter((part) => part !== "")
          .join("\n");
      } else if (isString(data.content)) {
        content = data.content;
      }

      if (!content) return null;
      const parsed = parseRecallContent(content);

      if (parsed == null) return null;

      return deserializeAgentState(parsed);
    } catch (err) {
      logger.error(
        `Memory state recall failed for mission ${missionId}: ${err instanceof Error ? err.message : String(err)}`,
      );

      return null;
    }
  }

  async set(missionId: string, state: AgentState, ttlSeconds?: number): Promise<void> {
    const serialized = serializeAgentState(state);
    await this.request("POST", ENDPOINTS.store, {
      session_id: missionId,
      content: JSON.stringify(serialized),
      ttl_seconds: ttlSeconds,
    });
  }

  async delete(_missionId: string): Promise<void> {}
}
