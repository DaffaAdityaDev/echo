import { useTraceStore } from "@/features/debug/stores/traceStore";
import { useChatStore } from "../../stores/chatStore";
import { sessionApi } from "../chat-api";
import { notifySystem } from "../system-notice";
import { abortActiveStreamRun, getActiveStreamRun } from "./stream-run";

const CANCEL_REQUEST_TIMEOUT_MS = 5000;

function isAbortError(err: { code?: string; name?: string } | null | undefined): boolean {
  return err?.code === "ERR_CANCELED" || err?.name === "AbortError";
}

// The fetch abort alone stops the stream; the cancel request makes the stop
// prompt across the chain by interrupting the in-flight LLM call.
function requestMissionCancel(sessionId: string): void {
  useTraceStore.getState().finalizeInterruptedForSession(sessionId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CANCEL_REQUEST_TIMEOUT_MS);

  sessionApi
    .cancel(sessionId, controller.signal)
    .catch((err: { code?: string; name?: string } | null | undefined) => {
      if (!isAbortError(err)) {
        notifySystem("warning", "CANCEL_FAILED", "Failed to cancel the in-flight mission.");
      }
    })
    .finally(() => clearTimeout(timeout));
}

function markInterrupted(messageId: string): void {
  useChatStore
    .getState()
    .setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.status === "streaming" ? { ...m, status: "interrupted" as const } : m)),
    );
}

export function stopActiveStream(): void {
  const run = abortActiveStreamRun();

  if (!run) return;

  markInterrupted(run.assistantMessageId);

  if (run.sessionId) requestMissionCancel(run.sessionId);

  const store = useChatStore.getState();
  store.setIsLoading(false);
  store.setAgentProgress(null);
  store.setAgentState("aborted");
}

// Switching to another session must not leave the old stream writing into
// the newly loaded conversation; re-selecting the streaming session keeps it.
export function stopStreamOutsideSession(sessionId: string): void {
  const run = getActiveStreamRun();

  if (run && run.sessionId !== sessionId) stopActiveStream();
}
