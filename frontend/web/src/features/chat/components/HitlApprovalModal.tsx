"use client";
import { Check, Clock, Shield, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useHitlApproval } from "../hooks/useHitlApproval";

export function HitlApprovalModal() {
  const { pending, clearPending, approve, deny } = useHitlApproval();
  const [decision, setDecision] = useState<"approve" | "deny" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!pending) return;
    const update = () => {
      const left = Math.max(0, Math.floor((pending.expiresAt - Date.now()) / 1000));
      setCountdown(`${left}s`);
      if (left <= 0) clearPending();
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [pending, clearPending]);

  const handleApprove = useCallback(async () => {
    if (!pending || decision) return;
    setDecision("approve");
    setLoading(true);
    await approve();
    setLoading(false);
  }, [pending, decision, approve]);

  const handleDeny = useCallback(async () => {
    if (!pending) return;
    setLoading(true);
    await deny(reason);
    setLoading(false);
  }, [pending, reason, deny]);

  const riskColors: Record<string, string> = {
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    critical: "bg-red-500/10 text-red-500 border-red-500/30",
  };

  const riskIcons: Record<string, typeof Shield> = {
    medium: Shield,
    high: ShieldAlert,
    critical: ShieldAlert,
  };

  if (!pending) return null;

  const RiskIcon = riskIcons[pending.riskLevel] || Shield;

  return (
    <Modal
      isOpen={!!pending && !decision}
      onClose={() => {
        if (!loading) clearPending();
      }}
      title="Tool Approval Required"
      description="Agent requires approval for protected tool"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tool</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {countdown}
            </span>
          </div>
          <code className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200">{pending.toolName}</code>
        </div>

        <div className={`p-3 rounded-lg border ${riskColors[pending.riskLevel] || riskColors.medium}`}>
          <div className="flex items-center gap-2">
            <RiskIcon className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{pending.riskLevel} Risk</span>
          </div>
        </div>

        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Arguments</span>
          <pre className="text-xs font-mono bg-zinc-900 text-zinc-100 dark:bg-black dark:text-zinc-300 p-3 rounded-lg overflow-x-auto max-h-32">
            {JSON.stringify(pending.args, null, 2)}
          </pre>
        </div>

        {decision === "deny" && (
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">
              Reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs font-mono bg-zinc-900 text-zinc-100 dark:bg-black dark:text-zinc-300 p-3 rounded-lg border border-zinc-700 resize-none h-20"
              placeholder="Why is this tool being denied?"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {decision !== "deny" && (
            <button
              type="button"
              onClick={() => setDecision("deny")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </button>
          )}
          {decision === "deny" && (
            <button
              type="button"
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/20 text-red-500 border border-red-500/50 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="animate-spin h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Confirm Deny
            </button>
          )}
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading && decision === "approve" ? (
              <span className="animate-spin h-3 w-3 border-2 border-emerald-500 border-t-transparent rounded-full" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}
