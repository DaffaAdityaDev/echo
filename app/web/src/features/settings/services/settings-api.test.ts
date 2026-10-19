import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_AGENT_CONFIG } from "../types";
import { toDTO } from "./settings-api";

describe("toDTO", () => {
  it("keeps the stored key when no new key was typed, even before hasApiKey is known", () => {
    const body = toDTO({ ...DEFAULT_AGENT_CONFIG, apiKey: "", hasApiKey: false });

    assert.equal(body.keep_api_key, true);
    assert.equal(body.api_key, undefined);
  });

  it("sends a typed key as a replacement", () => {
    const body = toDTO({ ...DEFAULT_AGENT_CONFIG, apiKey: "sk-new", hasApiKey: true });

    assert.equal(body.keep_api_key, false);
    assert.equal(body.api_key, "sk-new");
  });
});
