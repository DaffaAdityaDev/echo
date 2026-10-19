export class ApprovalClaimRegistry {
  private readonly claimExpiries = new Map<string, number>();

  constructor(private readonly retentionMs: number) {}

  /**
   * Check-and-claim runs synchronously so two concurrent decisions for the same
   * approval cannot both pass. Claims are retained past the paused-state TTL so
   * a request that read the state before it was deleted still loses the race.
   */
  tryClaim(approvalId: string, now: number = Date.now()): boolean {
    this.pruneExpired(now);

    if (this.claimExpiries.has(approvalId)) return false;
    this.claimExpiries.set(approvalId, now + this.retentionMs);

    return true;
  }

  /** Returns a claim whose approval could not be consumed, so a retry can still succeed. */
  release(approvalId: string): void {
    this.claimExpiries.delete(approvalId);
  }

  private pruneExpired(now: number): void {
    for (const [approvalId, expiresAt] of this.claimExpiries) {
      if (now >= expiresAt) this.claimExpiries.delete(approvalId);
    }
  }
}
