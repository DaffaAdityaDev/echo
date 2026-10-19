import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAT_ROLES } from "../constants";
import type { Message } from "../types";
import { appendedUserMessage } from "./appended-user-message";

function msg(id: string, role: Message["role"]): Message {
  return { id, role, content: "", steps: [] };
}

const turn = [msg("u1", CHAT_ROLES.USER), msg("a1", CHAT_ROLES.ASSISTANT)];

describe("appendedUserMessage", () => {
  it("detects a user turn appended after the previous last message", () => {
    const next = [...turn, msg("u2", CHAT_ROLES.USER), msg("a2", CHAT_ROLES.ASSISTANT)];

    assert.equal(appendedUserMessage(next, { lastId: "a1", length: 2 }), true);
  });

  it("ignores older history prepended before the previous last message", () => {
    const next = [msg("u0", CHAT_ROLES.USER), msg("a0", CHAT_ROLES.ASSISTANT), ...turn];

    assert.equal(appendedUserMessage(next, { lastId: "a1", length: 2 }), false);
  });

  it("does not force a scroll when a snapshot rebuild re-keys the same turn", () => {
    const rebuilt = [msg("user-1-7", CHAT_ROLES.USER), msg("asst-1-8", CHAT_ROLES.ASSISTANT)];

    assert.equal(appendedUserMessage(rebuilt, { lastId: "a1", length: 2 }), false);
  });

  it("treats a longer, re-keyed list ending in a user turn as a send", () => {
    const loaded = [...turn, msg("u9", CHAT_ROLES.USER), msg("a9", CHAT_ROLES.ASSISTANT)];

    assert.equal(appendedUserMessage(loaded, { lastId: "gone", length: 2 }), true);
  });

  it("treats a first load into an empty list as new", () => {
    assert.equal(appendedUserMessage(turn, { lastId: undefined, length: 0 }), true);
  });
});
