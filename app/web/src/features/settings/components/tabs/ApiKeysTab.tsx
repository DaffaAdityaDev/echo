"use client"; /* Top Banner */ /* One-Time Secret Key Display Modal */ /* Create Key Form Modal */ /* Keys List */

import { Check, Copy, Key, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";

import type React from "react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

import { useToast } from "@/hooks/useToast";

import { apiKeyService } from "../../services/apiKeyService";

import type { ApiKey } from "../../types/apiKey";

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);

  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);

  const [keyName, setKeyName] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const { showToast } = useToast();

  const fetchKeys = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiKeyService.list();

      setKeys(data || []);
    } catch {
      showToast("Failed to load API keys", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let ignore = false;

    apiKeyService
      .list()
      .then((data) => {
        if (!ignore) {
          setKeys(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          showToast("Failed to load API keys", "error");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [showToast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!keyName.trim() || submitting) return;

    setSubmitting(true);

    try {
      const res = await apiKeyService.create({ name: keyName.trim() });

      setCreatedKey(res.key);

      setIsCreating(false);

      setKeyName("");

      fetchKeys();

      showToast("API Key generated successfully!", "success");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to create API key";

      showToast(errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke API key "${name}"? External apps using this key will immediately lose access.`,
      )
    ) {
      return;
    }

    try {
      await apiKeyService.revoke(id);

      showToast("API Key revoked", "success");

      fetchKeys();
    } catch {
      showToast("Failed to revoke API key", "error");
    }
  };

  const handleCopy = () => {
    if (!createdKey) return;

    navigator.clipboard.writeText(createdKey);

    setCopied(true);

    setTimeout(() => setCopied(false), 2500);

    showToast("Secret key copied to clipboard!", "success");
  };

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Developer API Keys</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Authenticate external applications (like KataraGnosis or CLI) to access Echo agents.
            </p>
          </div>
        </div>

        <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="h-4 w-4" />
          <span>Create Key</span>
        </Button>
      </div>

      {}
      {createdKey && (
        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-bold text-amber-900 dark:text-amber-200">Save Your Secret Key Now</h5>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70">
                Please copy this secret key and store it securely (e.g. in your application environment variable). For
                your security, you will not be able to view it again.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <code className="flex-1 font-mono text-xs text-zinc-900 dark:text-zinc-100 select-all overflow-x-auto px-2">
              {createdKey}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="gap-1.5 text-xs font-semibold shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatedKey(null)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              I have saved my key
            </Button>
          </div>
        </div>
      )}

      {}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 space-y-3 animate-in fade-in"
        >
          <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Generate New Secret Key
          </h5>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="keyNameInput" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Key Name / Description
            </label>
            <input
              id="keyNameInput"
              type="text"
              required
              placeholder="e.g. KataraGnosis Integration, CLI Tool"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);

                setKeyName("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!keyName.trim() || submitting}
              className="gap-1.5 text-xs font-semibold"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
              <span>Generate Key</span>
            </Button>
          </div>
        </form>
      )}

      {}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Active Keys ({keys.filter((k) => k.status === "active").length})
          </h5>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            <span>Loading API keys...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 space-y-2">
            <Key className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="text-xs font-medium">No API keys created yet</p>
            <p className="text-[11px] text-zinc-500">
              Create a secret key to connect external tools and background services.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden bg-white dark:bg-zinc-950/40">
            {keys.map((k) => {
              const isRevoked = k.status === "revoked";

              const createdDate = new Date(k.created_at).toLocaleDateString(
                "id-ID",

                {
                  year: "numeric",

                  month: "short",

                  day: "numeric",
                },
              );

              return (
                <div
                  key={k.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    isRevoked
                      ? "opacity-50 bg-zinc-50 dark:bg-zinc-950/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {k.name || "Untitled Key"}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isRevoked
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        }`}
                      >
                        {k.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                      <span>{k.prefix}...</span>
                      <span className="text-zinc-500">•</span>
                      <span className="font-sans">Created {createdDate}</span>
                    </div>
                  </div>

                  {!isRevoked && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id, k.name)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
