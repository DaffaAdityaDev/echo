import { api } from "@/lib/api-client";
import { CHAT_ENDPOINTS, SESSION_ENDPOINTS } from "../constants";
import type { DbMessage, Session, StreamPacket } from "../types";

function mapSession(s: Record<string, unknown>): Session {
  return {
    id: s.id as string,
    title: s.title as string,
    createdAt: (s.created_at || s.createdAt) as string,
    updatedAt: (s.updated_at || s.updatedAt) as string,
    messageCount: (s.message_count ?? s.messageCount) as number,
    contextSummary: (s.context_summary || s.contextSummary) as string | undefined,
  };
}
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface PaginatedSessions {
  sessions: Session[];
  pagination: PaginationMeta;
}

export interface PaginatedMessages {
  messages: DbMessage[];
  pagination: PaginationMeta;
}

export const sessionApi = {
  list: async (limit?: number, offset?: number): Promise<PaginatedSessions> => {
    let query = "";
    if (limit !== undefined || offset !== undefined) {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", String(limit));
      if (offset !== undefined) params.append("offset", String(offset));
      query = `?${params.toString()}`;
    }
    const data = await api.get<{ sessions: Record<string, unknown>[]; pagination: PaginationMeta }>(
      `${SESSION_ENDPOINTS.LIST}${query}`,
    );
    return {
      sessions: (data.sessions || []).map(mapSession),
      pagination: data.pagination,
    };
  },
  create: async (title?: string): Promise<Session> => {
    const raw = await api.post<Record<string, unknown>>(SESSION_ENDPOINTS.CREATE, { title: title || "New Chat" });
    return mapSession(raw);
  },
  get: async (id: string): Promise<Session> => {
    const raw = await api.get<Record<string, unknown>>(SESSION_ENDPOINTS.GET(id));
    return mapSession(raw);
  },
  getMessages: async (id: string, limit?: number, offset?: number): Promise<PaginatedMessages> => {
    let query = "";
    if (limit !== undefined || offset !== undefined) {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", String(limit));
      if (offset !== undefined) params.append("offset", String(offset));
      query = `?${params.toString()}`;
    }
    const data = await api.get<{ messages: DbMessage[]; pagination: PaginationMeta }>(
      `${SESSION_ENDPOINTS.MESSAGES(id)}${query}`,
      { timeout: 120_000 },
    );
    return {
      messages: data.messages || [],
      pagination: data.pagination,
    };
  },
  updateTitle: async (id: string, title: string, summary?: string): Promise<void> => {
    return api.patch(SESSION_ENDPOINTS.UPDATE(id), { title, summary });
  },
  generateTitle: async (id: string, model: string): Promise<{ title: string; summary: string }> => {
    return api.post(`${SESSION_ENDPOINTS.UPDATE(id)}/generate-title`, { model });
  },
  delete: async (id: string): Promise<void> => {
    return api.delete(SESSION_ENDPOINTS.DELETE(id));
  },
  approve: (
    sessionId: string,
    body: Record<string, unknown>,
    onChunk: (data: StreamPacket) => void,
    signal: AbortSignal,
  ) => api.stream<StreamPacket>(`/sessions/${sessionId}/approve`, body, onChunk, { signal }),
  deny: (
    sessionId: string,
    body: Record<string, unknown>,
    onChunk: (data: StreamPacket) => void,
    signal: AbortSignal,
  ) => api.stream<StreamPacket>(`/sessions/${sessionId}/deny`, body, onChunk, { signal }),
};

export const chatApi = {
  sendMessage: (
    payload: Record<string, unknown>,
    onChunk: (data: StreamPacket) => void,
    signal: AbortSignal,
    onResponse?: (response: Response) => void,
  ) => api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, payload, onChunk, { signal, onResponse }),
};
