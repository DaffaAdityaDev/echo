import { useCallback } from "react";
import { sessionApi } from "../services/chat-api";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";

export function useHitlApproval() {
  const pending = useChatStore((s) => s.hitlPendingApproval);
  const clearPending = useChatStore((s) => s.clearHitlPendingApproval);

  const approve = useCallback(async () => {
    if (!pending) return;
    const controller = new AbortController();
    try {
      await sessionApi.approve(
        pending.sessionId,
        { approvalId: pending.approvalId, decision: "approve" },
        () => {},
        controller.signal,
      );
    } catch {
      notifySystem("error", "HITL_APPROVAL_FAILED", "Failed to send the approval decision.");
    } finally {
      clearPending();
    }
  }, [pending, clearPending]);

  const deny = useCallback(
    async (reason?: string) => {
      if (!pending) return;
      const controller = new AbortController();
      try {
        await sessionApi.deny(
          pending.sessionId,
          { approvalId: pending.approvalId, decision: "deny", reason },
          () => {},
          controller.signal,
        );
      } catch {
        notifySystem("error", "HITL_DENY_FAILED", "Failed to send the deny decision.");
      } finally {
        clearPending();
      }
    },
    [pending, clearPending],
  );

  return { pending, clearPending, approve, deny };
}
