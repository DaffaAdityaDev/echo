import { api } from "@/lib/api-client";
import { Message, StreamPacket } from "../types";
import { CHAT_ENDPOINTS } from "../constants";

export const chatApi = {
  sendMessage: async (message: string, model: string, onChunk: (data: StreamPacket) => void) => {
    return api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, { message, model }, onChunk);
  },

  getHistory: async (): Promise<Message[]> => {
    return api.get(CHAT_ENDPOINTS.HISTORY);
  },
  clearHistory: async () => {
    return api.delete(CHAT_ENDPOINTS.HISTORY);
  }
};


