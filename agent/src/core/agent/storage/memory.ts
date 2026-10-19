import type { AgentState, PausedMissionState } from "../../../shared/types";
import { deserializeAgentState, serializeStoredState } from "./serializer";
import { flattenStateKey, type StateKey } from "./state-key";

export class InMemoryStateProvider {
  private cache = new Map<string, string>();
  private expiries = new Map<string, number>();

  async get(key: StateKey): Promise<AgentState | null> {
    const cacheKey = flattenStateKey(key);
    const expiresAt = this.expiries.get(cacheKey);

    if (expiresAt !== undefined && Date.now() >= expiresAt) {
      this.evict(cacheKey);

      return null;
    }

    const raw = this.cache.get(cacheKey);

    if (!raw) return null;

    return deserializeAgentState(JSON.parse(raw));
  }

  async set(key: StateKey, state: AgentState | PausedMissionState, ttlSeconds?: number): Promise<void> {
    const cacheKey = flattenStateKey(key);
    const serialized = serializeStoredState(state);
    this.cache.set(cacheKey, JSON.stringify(serialized));

    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      this.expiries.set(cacheKey, Date.now() + ttlSeconds * 1000);
    } else {
      this.expiries.delete(cacheKey);
    }
  }

  async delete(key: StateKey): Promise<void> {
    this.evict(flattenStateKey(key));
  }

  private evict(cacheKey: string): void {
    this.cache.delete(cacheKey);
    this.expiries.delete(cacheKey);
  }
}
