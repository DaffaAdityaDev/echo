// The chat store renders a single conversation, so at most one stream may
// write into it. The registry owns that stream's AbortController so any
// component (chat page, sidebar, route change) can stop it, and gives each
// run an identity so late callbacks from a superseded run cannot clobber
// the state of the run that replaced it.

export interface StreamRun {
  readonly controller: AbortController;
  readonly assistantMessageId: string;
  sessionId: string | null;
  // Epoch ms after which a messages snapshot is known to include this turn.
  // Infinity while the turn has not settled.
  snapshotAfter: number;
}

let latestRun: StreamRun | null = null;
let activeRun: StreamRun | null = null;

export function startStreamRun(sessionId: string | null, assistantMessageId: string): StreamRun {
  activeRun?.controller.abort();
  latestRun = {
    controller: new AbortController(),
    assistantMessageId,
    sessionId,
    snapshotAfter: Number.POSITIVE_INFINITY,
  };
  activeRun = latestRun;

  return latestRun;
}

export function bindStreamRunSession(run: StreamRun, sessionId: string): void {
  run.sessionId = sessionId;
}

export function isActiveStreamRun(run: StreamRun): boolean {
  return activeRun === run;
}

export function isLatestStreamRun(run: StreamRun): boolean {
  return latestRun === run;
}

export function getActiveStreamRun(): StreamRun | null {
  return activeRun;
}

export function finishStreamRun(run: StreamRun): void {
  if (activeRun === run) activeRun = null;
}

export function abortActiveStreamRun(): StreamRun | null {
  const run = activeRun;

  if (!run) return null;
  run.controller.abort();
  activeRun = null;

  return run;
}

export function markStreamRunSnapshotRequested(run: StreamRun, at: number): void {
  run.snapshotAfter = at;
}

// True while the store still shows the latest run's local turn and the
// messages snapshot predates it: rebuilding from that snapshot would drop
// the user's message and the partial answer.
export function isAwaitingTurnSnapshot(
  sessionId: string | null,
  lastMessageId: string | undefined,
  snapshotUpdatedAt: number,
): boolean {
  if (!latestRun || latestRun.sessionId !== sessionId || latestRun.assistantMessageId !== lastMessageId) return false;

  return snapshotUpdatedAt < latestRun.snapshotAfter;
}
