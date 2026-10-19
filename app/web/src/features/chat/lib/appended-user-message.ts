import { CHAT_ROLES } from "../constants";
import type { Message } from "../types";

export interface MessageListTail {
  lastId: string | undefined;
  length: number;
}

function tailHasUserMessage(messages: Message[]): boolean {
  return messages.slice(-2).some((m) => m.role === CHAT_ROLES.USER);
}

// Only messages after the previously-last one count as new, so prepending
// older history pages never forces a jump to the bottom. When that message is
// gone (a snapshot rebuild re-keyed it, or another session loaded), only a
// list that grew with a user turn at its tail counts as a send.
export function appendedUserMessage(messages: Message[], prev: MessageListTail): boolean {
  const prevLastIndex = prev.lastId === undefined ? -1 : messages.findIndex((m) => m.id === prev.lastId);

  if (prev.lastId !== undefined && prevLastIndex === -1) {
    return messages.length > prev.length && tailHasUserMessage(messages);
  }

  return messages.slice(prevLastIndex + 1).some((m) => m.role === CHAT_ROLES.USER);
}
