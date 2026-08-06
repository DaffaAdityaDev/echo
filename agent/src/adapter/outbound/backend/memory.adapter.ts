import { ENV } from "../../../config/env";
import { deserializeAgentState, serializeAgentState } from "../../../core/agent/storage";
import type { AgentState } from "../../../shared/types";
import { signServiceJwt } from "../../../shared/utils/jwt";

const ENDPOINTS = {
  store: "/api/v1/internal/memory/episodic/store",
  recall: "/api/v1/internal/memory/episodic/recall",
};

function parseRecallContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    let last: unknown = null;
    for (const fragment of content.split("\n")) {
      if (fragment === "") continue;
      try {
        last = JSON.parse(fragment);
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
    this.baseUrl = baseUrl || ENV.BACKEND_URL || "http://localhost:8080";
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

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
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
    return res.json();
  }

  async get(missionId: string): Promise<AgentState | null> {
    try {
      const data = (await this.request("POST", ENDPOINTS.recall, {
        session_id: missionId,
      })) as {
        session_id?: string;
        entries?: Array<{ content?: unknown } | string>;
        content?: unknown;
      } | null;
      if (!data) return null;

      let content = "";
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        content = data.entries
          .map((entry) => {
            if (typeof entry === "string") return entry;
            const entryContent = entry?.content;
            if (typeof entryContent === "string") return entryContent;
            if (entryContent == null) return "";
            return JSON.stringify(entryContent);
          })
          .filter((part) => part !== "")
          .join("\n");
      } else if (typeof data.content === "string") {
        content = data.content;
      }

      if (!content) return null;
      const parsed = parseRecallContent(content);
      if (parsed == null) return null;
      return deserializeAgentState(parsed);
    } catch {
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
