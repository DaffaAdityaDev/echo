import { useChatStore } from "../stores/chatStore";
import type { SystemNotice } from "../types";

export function notifySystem(level: SystemNotice["level"], code: string, message: string): void {
  useChatStore.getState().appendSystemNotice({
    id: crypto.randomUUID(),
    level,
    code,
    message,
    timestamp: Date.now(),
  });
}
