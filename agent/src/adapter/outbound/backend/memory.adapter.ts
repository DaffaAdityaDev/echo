import { ENV } from "../../../config/env";
import { deserializeAgentState, serializeStoredState } from "../../../core/agent/storage/serializer";
import type { StateKey } from "../../../core/agent/storage/state-key";
import type { AgentState, JsonObject, JsonValue, PausedMissionState } from "../../../shared/types";
import { signServiceJwt } from "../../../shared/utils/jwt";
import { logger } from "../../../shared/utils/logger";

const ENDPOINTS = {
  store: "/api/v1/internal/memory/episodic/store",
  recall: "/api/v1/internal/memory/episodic/recall",
};

// The backend exposes no delete endpoint, so deletion appends a tombstone
// entry that shadows every older entry for the session slot.
const TOMBSTONE_KEY = "__deleted";
const TOMBSTONE_CONTENT = JSON.stringify({ [TOMBSTONE_KEY]: true });

const REQUEST_TIMEOUT_MS = 10_000;
const HTTP_NOT_FOUND = 404;

export class MemoryRequestError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Memory request failed: ${status} ${body}`);
    this.name = "MemoryRequestError";
  }
}

interface MemoryRecallResponse {
  session_id?: string;
  entries?: Array<{ content?: JsonValue } | string>;
  content?: JsonValue;
}

/**
 * The backend scopes episodic memory to the user owning `session_id` (it
 * resolves the owner itself and 404s unknown sessions); `slot` selects a
 * separate list within that session.
 */
function sessionScope(key: StateKey): JsonObject {
  return key.slot ? { session_id: key.sessionId, slot: key.slot } : { session_id: key.sessionId };
}

function isString<T>(val: T): val is T & string {
  return typeof val === "string";
}

function isTombstone(value: JsonValue): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value[TOMBSTONE_KEY] === true;
}

// The backend LPUSHes entries, so the newest one is first.
function newestEntryContent(data: MemoryRecallResponse): string {
  if (Array.isArray(data.entries) && data.entries.length > 0) {
    const newest = data.entries[0];

    if (isString(newest)) return newest;
    const entryContent = newest?.content;

    if (isString(entryContent)) return entryContent;

    return entryContent == null ? "" : JSON.stringify(entryContent);
  }

  return isString(data.content) ? data.content : "";
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new MemoryRequestError(res.status, text);
    }

    // SAFETY: fetch response JSON adheres to valid JsonValue representation
    return (await res.json()) as JsonValue;
  }

  /** Returns null only when no state exists; transport and backend failures propagate. */
  private async recall(key: StateKey): Promise<MemoryRecallResponse | null> {
    try {
      // SAFETY: Backend recall response body adheres to MemoryRecallResponse structure
      return (await this.request("POST", ENDPOINTS.recall, {
        ...sessionScope(key),
        limit: 1,
      })) as MemoryRecallResponse | null;
    } catch (err) {
      if (err instanceof MemoryRequestError && err.status === HTTP_NOT_FOUND) return null;
      throw err;
    }
  }

  async get(key: StateKey): Promise<AgentState | null> {
    const data = await this.recall(key);

    if (!data) return null;

    const content = newestEntryContent(data);

    if (!content) return null;

    try {
      const parsed = parseRecallContent(content);

      if (parsed == null || isTombstone(parsed)) return null;

      return deserializeAgentState(parsed);
    } catch (err) {
      logger.error(
        `Stored state for session ${key.sessionId} (slot ${key.slot ?? "-"}) is unreadable, starting fresh: ${err instanceof Error ? err.message : String(err)}`,
      );

      return null;
    }
  }

  async set(key: StateKey, state: AgentState | PausedMissionState, ttlSeconds?: number): Promise<void> {
    const serialized = serializeStoredState(state);
    const body: JsonObject = { ...sessionScope(key), content: JSON.stringify(serialized) };

    if (ttlSeconds !== undefined) body.ttl_seconds = ttlSeconds;

    await this.request("POST", ENDPOINTS.store, body);
  }

  async delete(key: StateKey): Promise<void> {
    await this.request("POST", ENDPOINTS.store, {
      ...sessionScope(key),
      content: TOMBSTONE_CONTENT,
    });
  }
}
