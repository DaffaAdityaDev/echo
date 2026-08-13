import type { AgentState } from "../../../shared/types";
import { deserializeAgentState, serializeAgentState } from "./serializer";

export class InMemoryStateProvider {
  private cache = new Map<string, string>();
  private expiries = new Map<string, number>();

  async get(missionId: string): Promise<AgentState | null> {
    const expiresAt = this.expiries.get(missionId);
    if (expiresAt !== undefined && Date.now() >= expiresAt) {
      this.delete(missionId);
      return null;
    }
    const raw = this.cache.get(missionId);
    if (!raw) return null;
    return deserializeAgentState(JSON.parse(raw));
  }

  async set(missionId: string, state: AgentState, ttlSeconds?: number): Promise<void> {
    const serialized = serializeAgentState(state);
    this.cache.set(missionId, JSON.stringify(serialized));
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      this.expiries.set(missionId, Date.now() + ttlSeconds * 1000);
    } else {
      this.expiries.delete(missionId);
    }
  }

  async delete(missionId: string): Promise<void> {
    this.cache.delete(missionId);
    this.expiries.delete(missionId);
  }
}
