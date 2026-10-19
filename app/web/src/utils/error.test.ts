import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractErrorMessage } from "./error";

describe("extractErrorMessage", () => {
  it("returns the message of an Error instance", () => {
    assert.equal(extractErrorMessage(new Error("boom")), "boom");
  });

  it("returns a string error as-is", () => {
    assert.equal(extractErrorMessage("plain failure"), "plain failure");
  });

  it("prefers message over error on plain objects", () => {
    assert.equal(extractErrorMessage({ message: "from message", error: "from error" }), "from message");
  });

  it("falls back to the error field when message is absent", () => {
    assert.equal(extractErrorMessage({ error: "from error" }), "from error");
  });

  it("ignores non-string fields and uses the fallback", () => {
    assert.equal(extractErrorMessage({ message: 42 }, "fallback"), "fallback");
  });

  it("uses the fallback for null, undefined and numbers", () => {
    assert.equal(extractErrorMessage(null, "fb"), "fb");
    assert.equal(extractErrorMessage(undefined, "fb"), "fb");
    assert.equal(extractErrorMessage(500, "fb"), "fb");
  });
});
