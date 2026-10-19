import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  abortActiveStreamRun,
  bindStreamRunSession,
  finishStreamRun,
  getActiveStreamRun,
  isActiveStreamRun,
  isAwaitingTurnSnapshot,
  isLatestStreamRun,
  markStreamRunSnapshotRequested,
  startStreamRun,
} from "./stream-run";

describe("stream run registry", () => {
  it("aborts and supersedes the previous run when a new one starts", () => {
    const first = startStreamRun("s1", "a1");
    const second = startStreamRun("s1", "a2");

    assert.equal(first.controller.signal.aborted, true);
    assert.equal(isActiveStreamRun(first), false);
    assert.equal(isLatestStreamRun(first), false);
    assert.equal(isActiveStreamRun(second), true);
    finishStreamRun(second);
  });

  it("lets any caller abort the active run", () => {
    const run = startStreamRun(null, "a1");

    assert.equal(abortActiveStreamRun(), run);
    assert.equal(run.controller.signal.aborted, true);
    assert.equal(getActiveStreamRun(), null);
    assert.equal(isLatestStreamRun(run), true);
  });

  it("keeps the local turn until a snapshot newer than the refresh request", () => {
    const run = startStreamRun(null, "a1");
    bindStreamRunSession(run, "s1");
    abortActiveStreamRun();

    assert.equal(isAwaitingTurnSnapshot("s1", "a1", 100), true);
    markStreamRunSnapshotRequested(run, 200);
    assert.equal(isAwaitingTurnSnapshot("s1", "a1", 150), true);
    assert.equal(isAwaitingTurnSnapshot("s1", "a1", 200), false);
  });

  it("ignores the pending turn once another session or message is shown", () => {
    startStreamRun("s1", "a1");
    abortActiveStreamRun();

    assert.equal(isAwaitingTurnSnapshot("s2", "a1", 0), false);
    assert.equal(isAwaitingTurnSnapshot("s1", "other", 0), false);
  });
});
