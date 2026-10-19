import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkTextAttachment, composeMessage, MAX_ATTACHMENT_BYTES } from "./text-attachment";

describe("checkTextAttachment", () => {
  it("accepts text mime types and known text extensions", () => {
    assert.deepEqual(checkTextAttachment({ name: "a.bin", type: "text/plain", size: 10 }), { ok: true });
    assert.deepEqual(checkTextAttachment({ name: "main.go", type: "", size: 10 }), { ok: true });
  });

  it("rejects binary files", () => {
    assert.equal(checkTextAttachment({ name: "photo.png", type: "image/png", size: 10 }).ok, false);
  });

  it("rejects files over the size limit", () => {
    assert.equal(checkTextAttachment({ name: "a.txt", type: "text/plain", size: MAX_ATTACHMENT_BYTES + 1 }).ok, false);
  });
});

describe("composeMessage", () => {
  it("returns the input unchanged without an attachment", () => {
    assert.equal(composeMessage("hello", null), "hello");
  });

  it("appends the attachment block after the input", () => {
    assert.equal(composeMessage("see", { name: "a.txt", content: "x" }), "see\n\n[Attached File: a.txt]\nx");
  });

  it("sends the attachment alone when the input is blank", () => {
    assert.equal(composeMessage("  ", { name: "a.txt", content: "x" }), "[Attached File: a.txt]\nx");
  });
});
