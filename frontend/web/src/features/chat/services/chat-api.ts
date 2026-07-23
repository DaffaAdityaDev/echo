import { api } from "@/lib/api-client";
import { Session, DbMessage } from "../types";
import { SESSION_ENDPOINTS } from "../constants";

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

export const sessionApi = {
  list: async (): Promise<Session[]> => {
    const data = await api.get<{ sessions: Record<string, unknown>[] }>(SESSION_ENDPOINTS.LIST);
    return (data.sessions || []).map(mapSession);
  },
  create: async (title?: string): Promise<Session> => {
    const raw = await api.post<Record<string, unknown>>(SESSION_ENDPOINTS.CREATE, { title: title || "New Chat" });
    return mapSession(raw);
  },
  get: async (id: string): Promise<Session> => {
    const raw = await api.get<Record<string, unknown>>(SESSION_ENDPOINTS.GET(id));
    return mapSession(raw);
  },
  getMessages: async (id: string): Promise<DbMessage[]> => {
    const data = await api.get<{ messages: DbMessage[] }>(SESSION_ENDPOINTS.MESSAGES(id));
    return data.messages;
  },
  updateTitle: async (id: string, title: string, summary?: string): Promise<void> => {
    return api.patch(SESSION_ENDPOINTS.UPDATE(id), { title, summary });
  },
  delete: async (id: string): Promise<void> => {
    return api.delete(SESSION_ENDPOINTS.DELETE(id));
  }
};
