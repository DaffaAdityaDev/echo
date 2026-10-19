import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { DEFAULT_AGENT_CONFIG } from "@/features/settings/types";
import { resetUserStores } from "./resetUserStores";

describe("resetUserStores", () => {
  it("clears the previous user's chat state and settings", () => {
    useChatStore.getState().setActiveSession("s1");
    useChatStore.getState().setSessions([
      { id: "s1", title: "private", createdAt: "2026-01-01", updatedAt: "2026-01-01", messageCount: 1 },
    ]);
    useSettingsStore.getState().setConfig({ defaultMode: "agent" });

    resetUserStores();

    assert.equal(useChatStore.getState().activeSessionId, null);
    assert.deepEqual(useChatStore.getState().sessions, []);
    assert.deepEqual(useSettingsStore.getState().config, DEFAULT_AGENT_CONFIG);
  });
});
