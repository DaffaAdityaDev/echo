import { abortActiveStreamRun } from "@/features/chat/services/stream/stream-run";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { useStudioStore } from "@/features/studio/stores/studioStore";

// Client stores outlive the session; wipe them when the user changes so the
// next account never sees the previous one's chats, traces or settings.
export function resetUserStores(): void {
  abortActiveStreamRun();
  useChatStore.setState(useChatStore.getInitialState(), true);
  useTraceStore.setState(useTraceStore.getInitialState(), true);
  useStudioStore.setState(useStudioStore.getInitialState(), true);
  useSettingsStore.getState().reset();
}
