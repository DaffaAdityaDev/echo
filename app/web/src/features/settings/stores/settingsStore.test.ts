import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { settingsApi } from "../services/settings-api";
import { type AgentConfig, DEFAULT_AGENT_CONFIG } from "../types";
import { useSettingsStore } from "./settingsStore";

const originalGet = settingsApi.get;
const serverConfig: AgentConfig = { ...DEFAULT_AGENT_CONFIG, defaultMode: "agent", hasApiKey: true };

describe("settingsStore.ensureHydrated", () => {
  afterEach(() => {
    settingsApi.get = originalGet;
    useSettingsStore.getState().reset();
  });

  it("loads the server config once and reuses it", async () => {
    let calls = 0;
    settingsApi.get = async () => {
      calls += 1;

      return serverConfig;
    };

    assert.equal(await useSettingsStore.getState().ensureHydrated(), true);
    assert.equal(await useSettingsStore.getState().ensureHydrated(), true);
    assert.equal(calls, 1);
    assert.equal(useSettingsStore.getState().config.defaultMode, "agent");
    assert.equal(useSettingsStore.getState().config.hasApiKey, true);
  });

  it("reports failure when the server config cannot be loaded", async () => {
    settingsApi.get = async () => {
      throw new Error("offline");
    };

    assert.equal(await useSettingsStore.getState().ensureHydrated(), false);
    assert.equal(useSettingsStore.getState().hydrated, false);
  });

  it("reset drops the hydrated config so the next user loads their own", async () => {
    settingsApi.get = async () => serverConfig;
    await useSettingsStore.getState().ensureHydrated();

    useSettingsStore.getState().reset();

    assert.equal(useSettingsStore.getState().hydrated, false);
    assert.deepEqual(useSettingsStore.getState().config, DEFAULT_AGENT_CONFIG);
  });
});
