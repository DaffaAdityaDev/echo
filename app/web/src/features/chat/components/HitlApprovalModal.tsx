"use client";

import { Check, Clock, Shield, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { useHitlApproval } from "../hooks/useHitlApproval";
import type { HitlApproval } from "../types";

const RISK_COLORS = {
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-danger/10 text-danger border-danger/30",
  critical: "bg-danger/15 text-danger border-danger/50",
} as const;

function getRiskColor(riskLevel: string): string {
  if (riskLevel === "high") return RISK_COLORS.high;

  if (riskLevel === "critical") return RISK_COLORS.critical;

  return RISK_COLORS.medium;
}

function renderRiskIcon(riskLevel: string) {
  if (riskLevel === "high" || riskLevel === "critical") {
    return <ShieldAlert className="h-4 w-4" aria-hidden="true" />;
  }

  return <Shield className="h-4 w-4" aria-hidden="true" />;
}

interface HitlApprovalDialogProps {
  pending: HitlApproval;
  clearPending: () => void;
  approve: () => Promise<void>;
  deny: (reason?: string) => Promise<void>;
}

export function HitlApprovalModal() {
  const { pending, clearPending, approve, deny } = useHitlApproval();

  if (!pending) return null;

  // Keyed by approval so each new request starts with a fresh decision state.
  return (
    <HitlApprovalDialog
      key={pending.approvalId}
      pending={pending}
      clearPending={clearPending}
      approve={approve}
      deny={deny}
    />
  );
}

function HitlApprovalDialog({ pending, clearPending, approve, deny }: HitlApprovalDialogProps) {
  const [isDenying, setIsDenying] = useState(false);
  const [reason, setReason] = useState("");
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.floor((pending.expiresAt - Date.now()) / 1000));
      setCountdown(`${left}s`);

      if (left <= 0) clearPending();
    };

    update();
    const id = setInterval(update, 1000);

    return () => clearInterval(id);
  }, [pending, clearPending]);

  return (
    <Modal
      isOpen
      onClose={clearPending}
      title="Tool Approval Required"
      description="Agent requires approval for protected tool"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-md bg-surface border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-bold text-muted uppercase tracking-wider">Tool</span>
            <span className="text-xs text-muted flex items-center gap-1" title="Time left to decide">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Expires in </span>
              {countdown}
            </span>
          </div>
          <code className="text-sm font-mono font-bold text-foreground break-all">{pending.toolName}</code>
        </div>

        <div className={cn("p-3 rounded-md border", getRiskColor(pending.riskLevel))}>
          <div className="flex items-center gap-2">
            {renderRiskIcon(pending.riskLevel)}
            <span className="text-xs font-bold uppercase tracking-wider">{pending.riskLevel} Risk</span>
          </div>
        </div>

        <div>
          <span className="text-2xs font-bold text-muted uppercase tracking-wider mb-1 block">Arguments</span>
          <pre className="text-xs font-mono bg-surface text-foreground border border-border p-3 rounded-md overflow-auto max-h-40">
            {JSON.stringify(pending.args, null, 2)}
          </pre>
        </div>

        {isDenying && (
          <div>
            <label
              htmlFor="hitl-deny-reason"
              className="text-2xs font-bold text-muted uppercase tracking-wider mb-1 block"
            >
              Reason (optional)
            </label>
            <textarea
              id="hitl-deny-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs font-mono bg-elevated text-foreground placeholder:text-subtle p-3 rounded-sm border border-border focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none h-20"
              placeholder="Why is this tool being denied?"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          {isDenying ? (
            <Button type="button" variant="danger" className="flex-1" onClick={() => deny(reason)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Confirm Deny
            </Button>
          ) : (
            <Button type="button" variant="danger" className="flex-1" onClick={() => setIsDenying(true)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Deny
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={approve}>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}
