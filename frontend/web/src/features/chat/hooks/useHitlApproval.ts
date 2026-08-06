import { useCallback } from "react";
import { missionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";

export function useHitlApprovalPending() {
  return useChatStore((s) => s.hitlPendingApproval);
}

export function useClearHitlApproval() {
  return useChatStore((s) => s.clearHitlPendingApproval);
}

export function useHitlApproval() {
  const pending = useHitlApprovalPending();
  const clearPending = useClearHitlApproval();

  const approve = useCallback(async () => {
    if (!pending) return;
    const controller = new AbortController();
    try {
      await missionApi.approve(
        pending.missionId,
        { approvalId: pending.approvalId, decision: "approve" },
        () => {},
        controller.signal,
      );
    } catch (e) {
      console.error("HITL approve stream error:", e);
    } finally {
      clearPending();
    }
  }, [pending, clearPending]);

  const deny = useCallback(
    async (reason?: string) => {
      if (!pending) return;
      const controller = new AbortController();
      try {
        await missionApi.deny(
          pending.missionId,
          { approvalId: pending.approvalId, decision: "deny", reason },
          () => {},
          controller.signal,
        );
      } catch (e) {
        console.error("HITL deny stream error:", e);
      } finally {
        clearPending();
      }
    },
    [pending, clearPending],
  );

  return { pending, clearPending, approve, deny };
}
