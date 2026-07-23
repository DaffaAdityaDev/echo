import { AgentState } from '../../shared/types';
import { signServiceJwt } from '../../shared/utils/jwt';
import { ENV } from '../../config/env';
import { serializeAgentState, deserializeAgentState } from '../../core/agent/storage/serializer';

const ENDPOINTS = {
  store: '/api/v1/internal/memory/episodic/store',
  recall: '/api/v1/internal/memory/episodic/recall',
};

export class MemoryAdapter {
  readonly type = 'memory';
  private baseUrl: string;
  private connected = false;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ENV.BACKEND_URL || 'http://localhost:8080';
  }

  async connect() {
    try {
      await this.request('GET', '/health');
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
      await this.request('GET', '/health');
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

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const token = signServiceJwt();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Memory request failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  async get(missionId: string): Promise<AgentState | null> {
    try {
      const data = await this.request('POST', ENDPOINTS.recall, {
        session_id: missionId,
      });
      if (!data || !data.content) return null;
      const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      return deserializeAgentState(parsed);
    } catch {
      return null;
    }
  }

  async set(missionId: string, state: AgentState, _ttlSeconds?: number): Promise<void> {
    const serialized = serializeAgentState(state);
    await this.request('POST', ENDPOINTS.store, {
      session_id: missionId,
      content: JSON.stringify(serialized),
    });
  }

  async delete(missionId: string): Promise<void> {
    // TTL-based cleanup is sufficient; no-op for now
  }
}
