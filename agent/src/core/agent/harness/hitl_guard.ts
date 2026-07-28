export const DEFAULT_PROTECTED_TOOLS = new Set([
  "execute_sql_write",
  "delete_file",
  "send_external_email",
  "deploy_infrastructure",
  "write_file",
]);

export interface HitlGuardConfig {
  enabled: boolean;
  protectedTools?: string[];
  ttlMinutes?: number;
}

export interface PendingApprovalState {
  approvalId: string;
  missionId: string;
  sessionId: string;
  toolCall: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };
  createdAt: number;
  expiresAt: number;
}

export class HitlGuard {
  private enabled: boolean;
  private protectedTools: Set<string>;
  private ttlMinutes: number;

  constructor(config?: Partial<HitlGuardConfig>) {
    this.enabled = config?.enabled ?? true;
    this.ttlMinutes = config?.ttlMinutes ?? 5;
    this.protectedTools = config?.protectedTools ? new Set(config.protectedTools) : DEFAULT_PROTECTED_TOOLS;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isProtected(toolName: string): boolean {
    if (!this.enabled) return false;
    return this.protectedTools.has(toolName);
  }

  public createApprovalPayload(
    missionId: string,
    sessionId: string,
    toolCall: { id: string; name: string; args: Record<string, unknown> },
  ): PendingApprovalState {
    const now = Date.now();
    return {
      approvalId: `appr_${crypto.randomUUID()}`,
      missionId,
      sessionId,
      toolCall,
      createdAt: now,
      expiresAt: now + this.ttlMinutes * 60 * 1000,
    };
  }
}
