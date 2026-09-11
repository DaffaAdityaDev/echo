import { api } from "@/lib/api-client";
import { CHAT_ENDPOINTS, SESSION_ENDPOINTS } from "../constants";
import type { DbMessage, Session, StreamPacket } from "../types";

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

export interface DecisionPayload {
  approvalId: string;
  decision: "approve" | "deny" | string;
  reason?: string;
}

export interface SendMessagePayload {
  message: string;
  sessionId?: string;
}

interface RawSessionPayload {
  id?: string | null;
  title?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  message_count?: number | null;
  messageCount?: number | null;
  context_summary?: string | null;
  contextSummary?: string | null;
}

function isString(val: string | number | null | undefined): val is string {
  return typeof val === "string";
}

function isNumber(val: string | number | null | undefined): val is number {
  return typeof val === "number";
}

function mapSession(s: RawSessionPayload): Session {
  const asString = (snakeVal?: string | null, camelVal?: string | null): string | undefined => {
    const value = snakeVal ?? camelVal;

    return isString(value) ? value : undefined;
  };

  const asNumber = (snakeVal?: number | null, camelVal?: number | null): number | undefined => {
    const value = snakeVal ?? camelVal;

    return isNumber(value) ? value : undefined;
  };

  return {
    id: isString(s.id) ? s.id : "",
    title: isString(s.title) ? s.title : "",
    createdAt: asString(s.created_at, s.createdAt) ?? "",
    updatedAt: asString(s.updated_at, s.updatedAt) ?? "",
    messageCount: asNumber(s.message_count, s.messageCount) ?? 0,
    contextSummary: asString(s.context_summary, s.contextSummary),
  };
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

    const data = await api.get<{ sessions: RawSessionPayload[]; pagination: PaginationMeta }>(
      `${SESSION_ENDPOINTS.LIST}${query}`,
    );

    return {
      sessions: (data.sessions || []).map(mapSession),
      pagination: data.pagination,
    };
  },
  create: async (title?: string): Promise<Session> => {
    const raw = await api.post<RawSessionPayload>(SESSION_ENDPOINTS.CREATE, { title: title || "New Chat" });

    return mapSession(raw);
  },
  get: async (id: string): Promise<Session> => {
    const raw = await api.get<RawSessionPayload>(SESSION_ENDPOINTS.GET(id));

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
  cancel: async (id: string, signal?: AbortSignal): Promise<void> => {
    await api.post(SESSION_ENDPOINTS.CANCEL(id), {}, { signal });
  },
  approve: (sessionId: string, body: DecisionPayload, onChunk: (data: StreamPacket) => void, signal: AbortSignal) =>
    api.stream<StreamPacket>(`/sessions/${sessionId}/approve`, body, onChunk, { signal }),
  deny: (sessionId: string, body: DecisionPayload, onChunk: (data: StreamPacket) => void, signal: AbortSignal) =>
    api.stream<StreamPacket>(`/sessions/${sessionId}/deny`, body, onChunk, { signal }),
};

export const chatApi = {
  sendMessage: (
    payload: SendMessagePayload,
    onChunk: (data: StreamPacket) => void,
    signal: AbortSignal,
    onResponse?: (response: Response) => void,
  ) => api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, payload, onChunk, { signal, onResponse }),
};
