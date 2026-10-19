import { STORAGE_CONSTANTS } from "./constants";

/**
 * Identifies a stored state. Every state belongs to the chat session the
 * mission runs for; the backend resolves the owning user from that session, so
 * a key can never reach another user's state. `slot` names a separate entry
 * inside the session (e.g. a paused HITL approval).
 */
export interface StateKey {
  readonly sessionId: string;
  readonly slot?: string;
}

export function missionStateKey(sessionId: string): StateKey {
  return { sessionId };
}

export function pausedStateKey(sessionId: string, approvalId: string): StateKey {
  return { sessionId, slot: `${STORAGE_CONSTANTS.PAUSED_SLOT_PREFIX}${approvalId}` };
}

/** Flattens a key for single-namespace stores such as the in-process cache. */
export function flattenStateKey(key: StateKey): string {
  return key.slot ? `${key.sessionId}${STORAGE_CONSTANTS.SLOT_SEPARATOR}${key.slot}` : key.sessionId;
}
