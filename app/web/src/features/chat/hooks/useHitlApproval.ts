import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { CHAT_QUERY_KEYS } from "../constants";
import { type DecisionPayload, sessionApi } from "../services/chat-api";
import { createResumePacketHandler } from "../services/stream/resume-stream";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";

const DECISION_FAILURES = {
  approve: { code: "HITL_APPROVAL_FAILED", message: "Failed to send the approval decision." },
  deny: { code: "HITL_DENY_FAILED", message: "Failed to send the deny decision." },
} as const;

export function useHitlApproval() {
  const pending = useChatStore((s) => s.hitlPendingApproval);
  const clearPending = useChatStore((s) => s.clearHitlPendingApproval);
  const queryClient = useQueryClient();

  const submitDecision = useCallback(
    async (decision: "approve" | "deny", reason?: string) => {
      if (!pending) return;
      const { sessionId, approvalId } = pending;
      const body: DecisionPayload = { approvalId, decision, reason };
      const send = decision === "approve" ? sessionApi.approve : sessionApi.deny;
      const onPacket = createResumePacketHandler(sessionId);

      clearPending();

      try {
        await send(sessionId, body, onPacket, new AbortController().signal);
      } catch {
        const failure = DECISION_FAILURES[decision];
        notifySystem("error", failure.code, failure.message);
      }

      try {
        await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(sessionId) });
      } catch {
        notifySystem("warning", "MESSAGE_REFRESH_FAILED", "Failed to refresh the message list.");
      }
    },
    [pending, clearPending, queryClient],
  );

  const approve = useCallback(() => submitDecision("approve"), [submitDecision]);
  const deny = useCallback((reason?: string) => submitDecision("deny", reason), [submitDecision]);

  return { pending, clearPending, approve, deny };
}
