import { api } from "@/lib/api-client";
import { Session, DbMessage } from "../types";
import { SESSION_ENDPOINTS } from "../constants";

export const sessionApi = {
  list: async (): Promise<Session[]> => {
    const data = await api.get<{ sessions: Session[] }>(SESSION_ENDPOINTS.LIST);
    return data.sessions;
  },
  create: async (title?: string): Promise<Session> => {
    return api.post(SESSION_ENDPOINTS.CREATE, { title: title || "New Chat" });
  },
  get: async (id: string): Promise<Session> => {
    return api.get(SESSION_ENDPOINTS.GET(id));
  },
  getMessages: async (id: string): Promise<DbMessage[]> => {
    const data = await api.get<{ messages: DbMessage[] }>(SESSION_ENDPOINTS.MESSAGES(id));
    return data.messages;
  },
  delete: async (id: string): Promise<void> => {
    return api.delete(SESSION_ENDPOINTS.DELETE(id));
  }
};
